import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MORTGAGE_PROGRAMS } from "../../packages/pulse-data/model";
import {
  calculateMortgageScenario,
  MORTGAGE_POLICY_VERSION,
} from "../../packages/domain/mortgagePolicy";
import { bestMortgageFit } from "../../packages/domain/propertyMatch";
import { safeMetadata } from "../src/validation";

test("shared mortgage policy: family scale and 50% rule stay deterministic",()=>{
  const familyTwo=calculateMortgageScenario({
    programs:DEFAULT_MORTGAGE_PROGRAMS,
    settings:{
      programId:"family",
      propertyKind:"newbuild",
      childrenCount:2,
      hasYoungChild:true,
      disabledChild:false,
      marketRate:15.7,
      years:15,
    },
    price:9_000_000,
    down:2_000_000,
    years:15,
  });
  assert.ok(familyTwo);
  assert.equal(familyTwo.policyVersion,MORTGAGE_POLICY_VERSION);
  assert.equal(familyTwo.preferredRate,8);
  assert.equal(familyTwo.subsidizedLimit,8_000_000);
  assert.equal(familyTwo.status,"eligible");
  assert.equal(familyTwo.invalid,false);

  const familyHalfDown=calculateMortgageScenario({
    programs:DEFAULT_MORTGAGE_PROGRAMS,
    settings:{
      programId:"family",
      propertyKind:"newbuild",
      childrenCount:1,
      hasYoungChild:true,
      disabledChild:false,
      marketRate:15.7,
      years:15,
    },
    price:8_000_000,
    down:4_000_000,
    years:15,
  });
  assert.ok(familyHalfDown);
  assert.equal(familyHalfDown.preferredRate,6);
});

test("shared mortgage policy: object and limit rules are enforced",()=>{
  const itSecondary=calculateMortgageScenario({
    programs:DEFAULT_MORTGAGE_PROGRAMS,
    settings:{programId:"it",propertyKind:"secondary",marketRate:15.5,years:20},
    price:8_000_000,
    down:2_000_000,
  });
  assert.ok(itSecondary);
  assert.equal(itSecondary.status,"blocked");
  assert.equal(itSecondary.invalid,true);

  const farEastLarge=calculateMortgageScenario({
    programs:DEFAULT_MORTGAGE_PROGRAMS,
    settings:{programId:"farEast",propertyKind:"newbuild",largeArea:true,years:20},
    price:10_000_000,
    down:2_100_000,
  });
  assert.ok(farEastLarge);
  assert.equal(farEastLarge.totalLimit,9_000_000);
  assert.equal(farEastLarge.invalid,false);
});

test("PULSE Select uses the same mortgage calculation as the mortgage screen",()=>{
  const scenario={
    programId:"family" as const,
    propertyKind:"newbuild" as const,
    childrenCount:3 as const,
    hasYoungChild:true,
    disabledChild:false,
    marketRate:15.7,
    years:15,
  };
  const direct=calculateMortgageScenario({
    programs:DEFAULT_MORTGAGE_PROGRAMS,
    settings:scenario,
    price:9_000_000,
    down:2_000_000,
  });
  assert.ok(direct);

  const fit=bestMortgageFit(
    9_000_000,
    2_000_000,
    direct.payment+1,
    DEFAULT_MORTGAGE_PROGRAMS,
    "family",
    scenario,
  );
  assert.equal(fit.payment,direct.payment);
  assert.equal(fit.fits,true);
});


test("analytics keeps policy version and exact result IDs while dropping private metadata",()=>{
  const clean=safeMetadata({
    source:"pulse-select-v4",
    policyVersion:MORTGAGE_POLICY_VERSION,
    propertyIds:["solnechniy","primorskiy",123,null],
    phone:"+79990000000",
    childrenCount:3,
  });
  assert.equal(clean.source,"pulse-select-v4");
  assert.equal(clean.policyVersion,MORTGAGE_POLICY_VERSION);
  assert.deepEqual(clean.propertyIds,["solnechniy","primorskiy"]);
  assert.equal("phone" in clean,false);
  assert.equal("childrenCount" in clean,false);
});


test("PULSE Control market rates feed every shared mortgage scenario",()=>{
  const programs=DEFAULT_MORTGAGE_PROGRAMS.map(item=>item.id==="standard"?{
    ...item,
    rate:14.2,
    marketRates:{newbuild:14.2,secondary:14.0,house:16.1},
  }:item);
  const standard=calculateMortgageScenario({
    programs,
    settings:{programId:"standard",propertyKind:"secondary",years:20},
    price:8_000_000,
    down:2_000_000,
  });
  assert.ok(standard);
  assert.equal(standard.marketRate,14.0);
  assert.equal(standard.preferredRate,14.0);

  const familyMixed=calculateMortgageScenario({
    programs,
    settings:{programId:"family",propertyKind:"newbuild",childrenCount:1,hasYoungChild:true,years:15},
    price:12_000_000,
    down:2_500_000,
  });
  assert.ok(familyMixed);
  assert.equal(familyMixed.marketRate,14.2);
});
