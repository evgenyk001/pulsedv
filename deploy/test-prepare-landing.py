#!/usr/bin/env python3
import importlib.util,json,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('landing',Path(__file__).with_name('prepare-landing.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class LandingTest(unittest.TestCase):
 def test_production_payload(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);current=root/'old';tracker=root/'tracker'
   seo='<!-- PULSE SEO start --><title>Production SEO</title><!-- PULSE SEO end -->'
   current.write_text('<head>'+seo+'</head>');tracker.write_text('// current acquisition')
   manifest=m.prepare(Path(__file__).resolve().parents[1]/'design/landing-dual-entry',root/'release',current,'abcdef012345-20261108T230000Z',tracker)
   page=(root/'release/index.html').read_text()
   self.assertIn(seo,page);self.assertNotIn('href="https://pulsedv.ru/app/"',page)
   self.assertIn('type="button" disabled',page);self.assertIn('<small>Скоро</small>',page)
   self.assertIn('href="https://t.me/pulsedvbot"',page)
   self.assertIn('/landing-cinematic/releases/abcdef012345-20261108T230000Z/assets/phone-',(root/'release/cinema.js').read_text())
   self.assertEqual((root/'release/acquisition.js').read_text(),tracker.read_text())
   self.assertGreater(len(manifest),15)
   import re
   for url in re.findall(r'(?:src|href)="(/landing-cinematic/releases/[^"?]+)',page):
    self.assertTrue((root/'release'/url.split('/',4)[4]).is_file(),url)
 def test_override_isolation(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);existing=root/'existing';out=root/'out';before=root/'before';after=root/'after'
   existing.write_text(json.dumps({'services':{'web':{'environment':{'UNCHANGED':'yes'},'volumes':['data:/data']}}}))
   m.make_override(existing,out);config=json.loads(out.read_text())
   self.assertEqual(config['services']['web']['environment'],{'UNCHANGED':'yes'})
   baseline={'services':{'web':{'volumes':[{'type':'volume','source':'data','target':'/data'}]},'api':{'image':'keep'}}}
   updated=json.loads(json.dumps(baseline));updated['services']['web']['volumes']+=config['services']['web']['volumes'][1:]
   before.write_text(json.dumps(baseline));after.write_text(json.dumps(updated));m.verify_config(before,after)
   updated['services']['api']['image']='wrong';after.write_text(json.dumps(updated))
   with self.assertRaises(ValueError):m.verify_config(before,after)
   existing.write_text(json.dumps({'services':{'web':{'volumes':['/other:/srv/index.html:ro']}}}))
   with self.assertRaises(ValueError):m.make_override(existing,out)
if __name__=='__main__':unittest.main()
