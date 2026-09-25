import React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ArrowLeft, ShieldCheck } from "lucide-react";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import { PasswordRegisterForm } from "../components/PasswordRegisterForm";
import { useAuth } from "../helpers/useAuth";
import { getSetupStatus } from "../endpoints/auth/setup_status_GET.schema";
import styles from "./login.module.css";

export default function LoginPage(){
  const navigate=useNavigate();
  const {authState}=useAuth();
  const [mode,setMode]=React.useState<"login"|"register">("login");
  const [canRegister,setCanRegister]=React.useState(false);

  React.useEffect(()=>{
    if(authState.type==="authenticated"&&authState.user.role==="admin")navigate("/admin",{replace:true});
  },[authState,navigate]);
  React.useEffect(()=>{
    getSetupStatus().then(result=>{
      setCanRegister(result.canRegister);
      if(result.canRegister)setMode("register");
    }).catch(()=>setCanRegister(false));
  },[]);

  return <main className={styles.page}>
    <div className={styles.ambient}/>
    <button className={styles.back} onClick={()=>navigate("/")}><ArrowLeft size={18}/>Приложение</button>
    <section className={styles.card}>
      <div className={styles.icon}><Building2 size={22}/></div>
      <span className={styles.eyebrow}>PULSE.DV workspace</span>
      <h1>{mode==="login"?"Вход для команды":"Создать доступ"}</h1>
      <p>{mode==="login"?"Управление объектами, фотографиями и входящими заявками.":"Первый созданный аккаунт получает права администратора."}</p>
      <div className={styles.tabs}>
        <button className={mode==="login"?styles.active:""} onClick={()=>setMode("login")}>Войти</button>
        {canRegister&&<button className={mode==="register"?styles.active:""} onClick={()=>setMode("register")}>Первичная настройка</button>}
      </div>
      {mode==="login"?<PasswordLoginForm/>:<PasswordRegisterForm/>}
      <div className={styles.secure}><ShieldCheck size={15}/>Доступ к админ-разделу защищён авторизацией</div>
    </section>
  </main>
}