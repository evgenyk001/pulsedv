from pxr import Usd,UsdGeom,UsdShade,Gf
import json,zipfile
from pathlib import Path
import tempfile,urllib.request
src=Path(tempfile.gettempdir())/'pulsedv-device-reference';src.mkdir(exist_ok=True)
url='https://www.apple.com/105/media/us/iphone-18-pro/2026/591df885-5ee2-4173-86e6-401021249f7c/ar/iphone-18-pro-e-sim.usdz'
if not (src/'iphone18.usdz').exists():urllib.request.urlretrieve(url,src/'iphone18.usdz')
z=zipfile.ZipFile(src/'iphone18.usdz');z.extractall(src/'unpacked')
s=Usd.Stage.Open(str(src/'iphone18.usdz'));meshes=[];materials={}
for p in s.Traverse():
 if not p.IsA(UsdGeom.Mesh) or '/UBGArkKGrAMRRnj/' not in str(p.GetPath()):continue
 m=UsdGeom.Mesh(p);xf=UsdGeom.Xformable(p).ComputeLocalToWorldTransform(Usd.TimeCode.Default());verts=[list(xf.Transform(Gf.Vec3d(*v))) for v in m.GetPointsAttr().Get()]
 mat=UsdShade.MaterialBindingAPI(p).ComputeBoundMaterial()[0];mid=mat.GetPrim().GetName()
 if mid not in materials:
  for shprim in mat.GetPrim().GetChildren():
   sh=UsdShade.Shader(shprim)
   if sh and sh.GetIdAttr().Get()=='UsdPreviewSurface':
    md={}
    for k in ['diffuseColor','metallic','roughness','emissiveColor','opacity']:
     i=sh.GetInput(k)
     if not i:continue
     v=i.Get();md[k]=list(v) if isinstance(v,Gf.Vec3f) else v
     conn=i.GetConnectedSource()
     if conn:
      reader=UsdShade.Shader(conn[0].GetPrim());a=reader.GetInput('file').Get()
      if a:
       leaf=a.path.split('/')[-1];matches=list((src/'unpacked').rglob(leaf));md[k+'Texture']=str(matches[0]) if matches else ''
    materials[mid]=md;break
 uv=UsdGeom.PrimvarsAPI(p).GetPrimvar('st');uvdata=uv.ComputeFlattened() if uv else None
 meshes.append({'name':p.GetName(),'verts':verts,'counts':list(m.GetFaceVertexCountsAttr().Get()),'indices':list(m.GetFaceVertexIndicesAttr().Get()),'mat':mid,'uv':list(map(list,uvdata)) if uvdata else [],'uvMode':str(uv.GetInterpolation()) if uv else ''})
json.dump({'meshes':meshes,'materials':materials},open(src/'model.json','w'))
for i in range(3):print('axis',i,min(v[i] for m in meshes for v in m['verts']),max(v[i] for m in meshes for v in m['verts']))
print(len(meshes),'meshes',len(materials),'materials')
print('large meshes',[(m['name'],len(m['verts']),m['mat']) for m in sorted(meshes,key=lambda m:len(m['verts']),reverse=True)[:8]])
