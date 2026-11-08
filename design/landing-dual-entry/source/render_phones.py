"""Studio renders based on the official Apple iPhone 18 Pro AR geometry.
17-series color variants use the same front-focused geometry as a visual mockup;
these are not claimed as certified CAD reproductions of every generation.
Run prepare_device_model.py (usd-core), prepare_screens.py (Pillow), then Blender.
The original Apple USDZ is fetched into a temporary folder, not redistributed.
"""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
import tempfile
root=Path(__file__).resolve().parents[1];data=json.load(open(Path(tempfile.gettempdir())/'pulsedv-device-reference/model.json'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=False
scene.render.resolution_x=700;scene.render.resolution_y=1440;scene.render.resolution_percentage=100;scene.render.film_transparent=True
scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.world.color=(.2,.2,.2)
parent=bpy.data.objects.new('Official device geometry',None);scene.collection.objects.link(parent)
materials={};colored=[]
for name,d in data['materials'].items():
 m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;p=nt.nodes.get('Principled BSDF');c=d.get('diffuseColor') or [.025,.027,.03];p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=d.get('metallic') if d.get('metallic') is not None else .5;p.inputs['Roughness'].default_value=max(.14,d.get('roughness') if d.get('roughness') is not None else .3)
 if c[0]>c[1]*1.25 and c[0]>c[2]*1.10:colored.append((p,c))
 else:
  path=d.get('diffuseColorTexture')
  if path:
   t=nt.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(path,check_existing=True);nt.links.new(t.outputs['Color'],p.inputs['Base Color'])
 materials[name]=m
texmat=bpy.data.materials.new('App OLED');texmat.use_nodes=True;nt=texmat.node_tree;nt.nodes.clear();output=nt.nodes.new('ShaderNodeOutputMaterial');em=nt.nodes.new('ShaderNodeEmission');em.inputs['Strength'].default_value=.97;tex=nt.nodes.new('ShaderNodeTexImage');nt.links.new(tex.outputs['Color'],em.inputs['Color']);nt.links.new(em.outputs[0],output.inputs['Surface'])
scale=3.73/(7.498043537139893+7.498032569885254);cx=(-1.7756785297393798+5.49186264038086)/2;cy=(7.498043537139893-7.498032569885254)/2
for d in data['meshes']:
 verts=[((v[0]-cx)*scale,(v[1]-cy)*scale,-(v[2]-.43750366568565513)*scale) for v in d['verts']]
 faces=[];off=0
 for count in d['counts']:faces.append(tuple(reversed(d['indices'][off:off+count])));off+=count
 mesh=bpy.data.meshes.new(d['name']);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(d['name'],mesh);scene.collection.objects.link(o);o.parent=parent
 for f in mesh.polygons:f.use_smooth=True
 screen=d['name']=='EHjrGDHNHzgNjtE'
 mesh.materials.append(texmat if screen else materials[d['mat']])
 uv=mesh.uv_layers.new(name='UVMap')
 if screen:
  for f in mesh.polygons:
   for li in f.loop_indices:
    vi=mesh.loops[li].vertex_index;v=d['verts'][vi];uv.data[li].uv=((v[0]+1.4665)/6.650,(v[1]+7.234)/14.468)
  o.location.z=.0005
 elif d['uv']:
  off=0
  for f in mesh.polygons:
   count=len(f.loop_indices)
   for j,li in enumerate(f.loop_indices):
    idx=off+count-1-j if d['uvMode']=='faceVarying' else mesh.loops[li].vertex_index
    if idx<len(d['uv']):uv.data[li].uv=d['uv'][idx]
   off+=count

def light(name,loc,power,size,yscale=.6):
 dt=bpy.data.lights.new(name,'AREA');dt.energy=power;dt.shape='RECTANGLE';dt.size=size;dt.size_y=size*yscale;o=bpy.data.objects.new(name,dt);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
light('Tall key softbox',(-3,3,5),350,4,1.5);light('Edge white strip',(3,0,2),260,2,2);light('Upper rear contour',(-3,3,-2),35,4);light('Front bounce',(0,0,6),35,5)
camdt=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',camdt);scene.collection.objects.link(cam);cam.location=(0,0,9);cam.rotation_euler=(0,0,0);camdt.type='ORTHO';camdt.ortho_scale=4.12;scene.camera=cam
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
# Five requested finishes, preserving the source material's relative tonal detail.
finishes={'orange':(.62,.155,.025),'navy':(.025,.045,.105),'glacier':(.35,.49,.59),'black':(.015,.018,.024),'burgundy':(.12,.030,.041)}
shots=[('home','orange',-23,False),('catalog','navy',22,True),('property','glacier',-20,False),('floorplans','black',23,True),('favorites','navy',-24,True),('mortgage','orange',21,True),('partners','black',-20,False),('giveaway','burgundy',23,True)]
if '--test' in sys.argv:shots=shots[:1]
for name,color,angle,is_max in shots:
 target=finishes[color]
 for node,c in colored:
  factor=min(1.6,max(.45,c[0]/.12));node.inputs['Base Color'].default_value=(*(min(.8,v*factor) for v in target),1)
 parent.scale=(1.04,1.04,1.04) if is_max else (1,1,1)
 parent.rotation_euler=(math.radians(-3),math.radians(angle),0)
 tex.image=bpy.data.images.load(str(root/'source'/('screen-'+name+'.png')),check_existing=True)
 scene.render.filepath=str(root/'source'/('phone-'+name+'.png'));bpy.ops.render.render(write_still=True)
