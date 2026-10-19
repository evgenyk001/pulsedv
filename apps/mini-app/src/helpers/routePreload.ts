const loaders={
 '/catalog':()=>import('../pages/catalog'),
 '/mortgage':()=>import('../pages/mortgage'),
 '/selection':()=>import('../pages/selection'),
 '/favorites':()=>import('../pages/favorites'),
};
type Path=keyof typeof loaders;
const pending=new Map<Path,Promise<any>>();
export function loadMiniAppRoute(path:Path){
 let task=pending.get(path);
 if(!task){task=loaders[path]();pending.set(path,task);void task.catch(()=>pending.delete(path));}
 return task;
}
export function prefetchMiniAppRoute(path:string){if(path in loaders)void loadMiniAppRoute(path as Path).catch(()=>{});}
