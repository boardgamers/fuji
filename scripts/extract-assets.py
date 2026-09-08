"""Extract licensed production artwork. Requires Poppler and Pillow.
Usage: python scripts/extract-assets.py /path/to/extracted/archives
"""
import sys,subprocess,tempfile
from pathlib import Path
from PIL import Image
source=Path(sys.argv[1]); dest=Path(__file__).resolve().parents[1]/'packages/viewer/src/assets';dest.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
 pdf=source/'independent/Cards/fuji_land_front_Print3.pdf'
 rows=subprocess.check_output(['pdfimages','-list',str(pdf)],text=True).splitlines()[2:]
 subprocess.run(['pdfimages','-png',str(pdf),tmp+'/land'],check=True)
 selected={}
 for row in rows:
  f=row.split()
  if len(f)<6 or f[2]!='image':continue
  page,num,w,h=int(f[0]),int(f[1]),int(f[3]),int(f[4])
  if w<500 or h<500 or page in selected:continue
  selected[page]=num
  im=Image.open(f'{tmp}/land-{num:03}.png').convert('RGB')
  im.thumbnail((800,800))
  im.save(dest/f'land-{page:02}.webp',quality=82)
 for name,file in [('character','en/Cards/fuji_character_cards_Front_E.pdf'),('equipment','en/Cards/fuji_equipment_cards_Front_E.pdf'),('skill','en/Cards/fuji_skill_cards_Front_E.pdf')]:
  subprocess.run(['pdftoppm','-scale-to','650','-png',str(source/file),tmp+'/'+name],check=True,stderr=subprocess.DEVNULL)
  for page,p in enumerate(sorted(Path(tmp).glob(name+'-*.png')),1):
   im=Image.open(p).convert('RGB');margin=round(im.width*14.17/212.598) if name!='equipment' else round(im.width*8.5/201.26)
   im.crop((margin,margin,im.width-margin,im.height-margin)).save(dest/f'{name}-{page:02}.webp',quality=88)
print('Extracted',len(list(dest.glob('*.webp'))),'web assets')
