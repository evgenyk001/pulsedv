"""Prepare screen maps from browser captures. Run from this directory's parent.
Requires Pillow; does not read or modify the live application.
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
root=Path(__file__).resolve().parents[1]
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(font_path,24)
for name in ['home','catalog','property','floorplans','favorites','mortgage','partners','giveaway']:
 image=Image.new('RGB',(780,1690),'#f8fafc')
 image.paste(Image.open(root/'assets'/('app-'+name+'.jpg')).resize((780,1610)),(0,80))
 d=ImageDraw.Draw(image);d.text((57,29),'9:41',fill='#15171b',font=font)
 for i in range(4):d.rectangle((630+i*8,49-i*4,635+i*8,58),fill='#15171b')
 d.arc((671,30,697,55),215,325,fill='#15171b',width=3)
 d.arc((677,37,691,52),215,325,fill='#15171b',width=3)
 d.ellipse((682,44,686,48),fill='#15171b')
 d.rounded_rectangle((708,31,737,46),radius=4,outline='#15171b',width=2)
 d.rectangle((712,35,732,42),fill='#15171b');d.rectangle((739,36,741,41),fill='#15171b')
 image.save(root/'source'/('screen-'+name+'.png'))
