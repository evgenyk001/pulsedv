"""Blender 4.3: physically shaded phone renders; no external model or textures.
Run from design/landing-dual-entry with blender -b -t 8 --python source/render_phones.py
"""
import bpy,math,os
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=80;scene.cycles.use_denoising=False
scene.render.resolution_x=700;scene.render.resolution_y=1440;scene.render.resolution_percentage=100;scene.render.film_transparent=True
scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.world.color=(.25,.25,.25)

def mat(name,color,metal=0,rough=.3):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
rim=mat('Natural titanium',(0.42,.405,.385),1,.23)
black=mat('Polished glass edge',(.012,.014,.018),.4,.12)
back=mat('Satin titanium',(.23,.225,.22),.7,.35)
antenna=mat('Antenna ceramic',(.09,.09,.09),0,.5)
pillmat=mat('Dynamic island',(.002,.002,.003),0,.18)
lensmat=mat('Camera sapphire',(.012,.025,.055),.75,.12)
rootobj=bpy.data.objects.new('iPhone',None);scene.collection.objects.link(rootobj)

def contour(w,h,r,n=20):
 out=[]
 for cx,cy,a in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
  for i in range(n+1):
   th=math.radians(a+i*90/n);out.append((cx+r*math.cos(th),cy+r*math.sin(th)))
 return out

def body(name,w,h,r,d,z,m):
 co=contour(w,h,r);n=len(co);verts=[(x,y,z-d/2) for x,y in co]+[(x,y,z+d/2) for x,y in co]
 faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.parent=rootobj;mesh.materials.append(m)
 for f in mesh.polygons:f.use_smooth=len(f.vertices)==4
 bevel=o.modifiers.new('Machined edge','BEVEL');bevel.width=.009;bevel.segments=3
 o.modifiers.new('Corner normals','WEIGHTED_NORMAL');return o
body('Titanium chassis',1.73,3.73,.29,.16,0,rim)
body('Glass perimeter',1.698,3.697,.273,.025,.086,black)
body('Rear glass',1.696,3.695,.273,.015,-.087,back)

def plane(name,w,h,r,z,m):
 co=contour(w,h,r,32);mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,y,z) for x,y in co],[],[tuple(range(len(co)))]);mesh.update()
 uv=mesh.uv_layers.new(name='UVMap')
 for f in mesh.polygons:
  for li in f.loop_indices:
   v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v.x/w+.5,v.y/h+.5)
 o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.parent=rootobj;mesh.materials.append(m);return o
screenmat=bpy.data.materials.new('OLED screen');screenmat.use_nodes=True;nt=screenmat.node_tree;nt.nodes.clear();out=nt.nodes.new('ShaderNodeOutputMaterial');em=nt.nodes.new('ShaderNodeEmission');em.inputs['Strength'].default_value=.92;tex=nt.nodes.new('ShaderNodeTexImage');nt.links.new(tex.outputs['Color'],em.inputs['Color']);nt.links.new(em.outputs[0],out.inputs['Surface'])
plane('OLED',1.597,3.588,.23,.106,screenmat)
pill=plane('Dynamic island',.43,.112,.056,.108,pillmat);pill.location.y=1.68
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.019,location=(.145,1.68,.11));lens=bpy.context.object;lens.scale.z=.13;lens.data.materials.append(lensmat);lens.parent=rootobj
for x,y,l in [(-.876,.96,.18),(-.876,.49,.36),(-.876,-.02,.36),(.876,.48,.56)]:
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,0));o=bpy.context.object;o.name='Titanium button';o.dimensions=(.025,l,.055);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=rootobj;o.data.materials.append(rim);mod=o.modifiers.new('Rounded button','BEVEL');mod.width=.012;mod.segments=5;o.modifiers.new('Normals','WEIGHTED_NORMAL')
for x in [-.869,.869]:
 for y in [-1.28,1.28]:
  bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,0));o=bpy.context.object;o.dimensions=(.004,.024,.15);o.data.materials.append(antenna);o.parent=rootobj

def light(name,loc,power,size,target=(0,0,0),scale=None):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='RECTANGLE';data.size=size;data.size_y=size*.6
 o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
light('Large softbox left',(-3,4,5),450,4)
light('White strip right',(3,1,2),300,2)
light('Edge strip',(-2,-2,-1),350,3)
light('Front fill',(0,1,6),70,5)
camdata=bpy.data.cameras.new('Product camera');cam=bpy.data.objects.new('Product camera',camdata);scene.collection.objects.link(cam);cam.location=(0,0,9);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=4.05;scene.camera=cam
# Small true camera turn exposes both polished edge and side buttons.
rootobj.rotation_euler=(math.radians(-2),math.radians(-12),0)
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
for name in ['home','catalog','property','floorplans','favorites','mortgage','partners','giveaway']:
 rootobj.rotation_euler.y=math.radians(12 if name in ['catalog','floorplans','mortgage','giveaway'] else -12)
 image=bpy.data.images.load(str(root/'source'/('screen-'+name+'.png')),check_existing=True);tex.image=image
 scene.render.filepath=str(root/'source'/('phone-'+name+'.png'));bpy.ops.render.render(write_still=True)
