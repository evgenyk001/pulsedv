import {readConfig} from './config';
import {deploymentIssues} from './deploymentReadiness';

try{
 const issues=deploymentIssues(readConfig());
 for(const issue of issues)console.log(`${issue.level.toUpperCase()}: ${issue.message}`);
 if(issues.some(i=>i.level==='error'))process.exitCode=1;
 else console.log('Конфигурация проверена. Проверьте DNS/HTTPS, Telegram, карту, резервную копию и восстановление на целевом VPS.');
}catch{
 // Never print Zod input or URLs: environment variables may contain credentials.
 console.error('ERROR: неверная конфигурация. Проверьте обязательные переменные по .env.example.');
 process.exitCode=1;
}
