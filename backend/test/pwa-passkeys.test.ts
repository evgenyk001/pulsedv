import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash,generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {isoCBOR} from '@simplewebauthn/server/helpers';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {tokenHash} from '../src/security';
import {readConfig} from '../src/config';
const b64=(v:Uint8Array|string)=>Buffer.from(v).toString('base64url');
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest();
// A real ES256 software authenticator: the server's cryptographic verifier is never mocked.
function authenticator(origin:string){
 const rp=new URL(origin).hostname,{privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=publicKey.export({format:'jwk'}),id=randomBytes(32),credentialId=b64(id);let counter=0;
 const auth=(flags:number)=>{const n=Buffer.alloc(4);n.writeUInt32BE(++counter);return Buffer.concat([sha(rp),Buffer.from([flags]),n])};
 return {credentialId,registration(challenge:string,uv=true,atOrigin=origin){
  const client=Buffer.from(JSON.stringify({type:'webauthn.create',challenge,origin:atOrigin}));
  const len=Buffer.alloc(2);len.writeUInt16BE(id.length);
  const cose=new Map<number,any>([[1,2],[3,-7],[-1,1],[-2,Buffer.from(jwk.x!,'base64url')],[-3,Buffer.from(jwk.y!,'base64url')]]);
  const data=Buffer.concat([auth(uv?69:65),Buffer.alloc(16),len,id,isoCBOR.encode(cose)]);
  return {id:credentialId,rawId:credentialId,type:'public-key',clientExtensionResults:{},response:{clientDataJSON:b64(client),attestationObject:b64(isoCBOR.encode(new Map<string,any>([['fmt','none'],['attStmt',new Map()],['authData',data]]))),transports:['internal']}};
 },assertion(challenge:string,uv=true,atOrigin=origin){const client=Buffer.from(JSON.stringify({type:'webauthn.get',challenge,origin:atOrigin})),data=auth(uv?5:1);return {id:credentialId,rawId:credentialId,type:'public-key',clientExtensionResults:{},response:{clientDataJSON:b64(client),authenticatorData:b64(data),signature:b64(sign('sha256',Buffer.concat([data,sha(client)]),privateKey))}}}};
}
test('PWA passkeys enforce signature, origin, user verification, session binding, replay and grant revocation',async t=>{
 const db=await testDatabase();await migrate(db);let code='';
 const config=readConfig({DATABASE_URL:'unused',NODE_ENV:'test',PWA_SMS_LOGIN:'true',SMS_RU_API_ID:'fake',PHONE_OTP_SECRET:'test-secret-longer-than-thirty-two-characters'});
 const app=await createApp(db,config,{sms:async(_p,c)=>{code=c}});t.after(async()=>{await app.close();await db.close()});
 const session=async()=>{const s=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers:{origin:config.PUBLIC_ORIGIN},payload:{}})).json();return {s,h:{origin:config.PUBLIC_ORIGIN,authorization:'Bearer '+s.accessToken}}};
 const a=await session(),other=await session();
 const post=(path:string,payload:any,h:any=a.h)=>app.inject({method:'POST',url:'/api/v1'+path,headers:h,payload});
 const req=await post('/me/account/sms/request',{phone:'+79995550101',consent:true,consentVersion:config.CONSENT_VERSION});assert.equal(req.statusCode,200,req.body);
 const login=await post('/me/account/sms/verify',{challengeId:req.json().challengeId,code});assert.equal(login.statusCode,200,login.body);a.h.authorization='Bearer '+login.json().accessToken;
 const key=authenticator(config.PUBLIC_ORIGIN),base='/me/account/passkeys';
 assert.equal((await app.inject({url:'/api/v1/me/partner',headers:a.h})).statusCode,423);
 assert.equal((await app.inject({url:'/api/v1/me/partner',headers:{...a.h,'x-app-variant':'telegram'}})).statusCode,423,'client headers cannot downgrade the guard');
 const ro=await post(base+'/register/options',{});assert.equal(ro.statusCode,200,ro.body);const r=ro.json();assert.equal(r.options.authenticatorSelection.userVerification,'required');
 const registered=await post(base+'/register/verify',{challengeId:r.challengeId,response:key.registration(r.options.challenge)});assert.equal(registered.statusCode,200,registered.body);
 const grant=registered.json().grant,h={...a.h,'x-partner-unlock':grant};
 assert.equal((await app.inject({url:'/api/v1/me/partner',headers:h})).statusCode,200);
 assert.equal((await post(base+'/register/verify',{challengeId:r.challengeId,response:key.registration(r.options.challenge)})).statusCode,400);
 const loginOpts=(await post(base+'/login/options',{},other.h)).json();
 assert.equal((await post(base+'/login/verify',{challengeId:loginOpts.challengeId,response:key.assertion(loginOpts.options.challenge)},a.h)).statusCode,400,'another session cannot consume a challenge');
 const byKey=await post(base+'/login/verify',{challengeId:loginOpts.challengeId,response:key.assertion(loginOpts.options.challenge)},other.h);assert.equal(byKey.statusCode,200,byKey.body);assert.ok(byKey.json().accessToken);
 assert.equal((await db.query('select auth_provider from sessions where id=$1',[other.s.sessionId])).rows[0].auth_provider,'passkey');
 for(const mode of ['origin','uv','signature']){
  const o=(await post(base+'/unlock/options',{})).json();const response=key.assertion(o.options.challenge,mode!=='uv',mode==='origin'?'https://attacker.test':config.PUBLIC_ORIGIN);if(mode==='signature')response.response.signature=b64(randomBytes(70));
  const invalid=await post(base+'/unlock/verify',{challengeId:o.challengeId,response});assert.equal(invalid.statusCode,400,mode+invalid.body);
  assert.equal((await post(base+'/unlock/verify',{challengeId:o.challengeId,response:key.assertion(o.options.challenge)})).statusCode,400,'failed proof is consumed');
 }
 const o=(await post(base+'/unlock/options',{})).json();const unlocked=await post(base+'/unlock/verify',{challengeId:o.challengeId,response:key.assertion(o.options.challenge)});assert.equal(unlocked.statusCode,200,unlocked.body);
 await post(base+'/lock',{});assert.equal((await app.inject({url:'/api/v1/me/partner',headers:{...a.h,'x-partner-unlock':unlocked.json().grant}})).statusCode,423);
 const current=(await post(base+'/unlock/options',{})).json();const latest=await post(base+'/unlock/verify',{challengeId:current.challengeId,response:key.assertion(current.options.challenge)});
 assert.equal((await post(base+'/remove',{id:key.credentialId},{...a.h,'x-partner-unlock':latest.json().grant})).statusCode,200);
 assert.equal((await app.inject({url:'/api/v1/me/partner',headers:h})).statusCode,423,'deleted keys revoke old grants');
 const user=(await db.query('select user_id from sessions where id=$1',[a.s.sessionId])).rows[0].user_id;
 await db.query("insert into partner_biometric_credentials(user_id,device_hash,token_hash,active) values($1,'device','token',true)",[user]);
 assert.equal((await post(base+'/register/options',{})).statusCode,403,'SMS alone cannot bypass an existing Telegram guard');
 const approvalId=randomUUID(),revision=(await db.query('select revision from partner_biometric_credentials where user_id=$1',[user])).rows[0].revision;
 await db.query('insert into pwa_legacy_approvals(user_id,id,code_hash,revision) values($1,$2,$3,$4)',[user,approvalId,tokenHash(approvalId+':12345678'),revision]);
 assert.equal((await post(base+'/register/options',{approvalCode:'00000000'})).statusCode,403);
 const approved=await post(base+'/register/options',{approvalCode:'12345678'});assert.equal(approved.statusCode,200,approved.body);
 assert.equal(Number((await db.query('select attempts from pwa_legacy_approvals where user_id=$1',[user])).rows[0].attempts),2,'incorrect attempts are committed');
 const ar=approved.json();
 await db.query('update partner_biometric_credentials set revision=gen_random_uuid() where user_id=$1',[user]);
 assert.equal((await post(base+'/register/verify',{challengeId:ar.challengeId,response:key.registration(ar.options.challenge)})).statusCode,400,'changing the legacy guard invalidates enrollment');
 await db.query("update sessions set phone_verified_at=now()-interval '6 minutes' where id=$1",[a.s.sessionId]);
 assert.equal((await post(base+'/register/options',{})).statusCode,428,'first enrollment requires recent SMS');

});
