import { getServerUserSession } from "./getServerUserSession";

export async function requireAdmin(request:Request){
  const session=await getServerUserSession(request);
  if(session.user.role!=="admin")throw new Error("Admin access required");
  return session.user;
}