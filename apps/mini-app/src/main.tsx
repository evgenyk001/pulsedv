import { configureRuntime } from "../../../packages/pulse-data/runtime";
import { RuntimeGate } from "./components/RuntimeGate";
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./floot-runtime.css";
import "./base.css";
import { AppShell } from "./components/AppShell";
import HomePage from "./pages/_index";
import JourneyPage from "./pages/journey";
import CatalogPage from "./pages/catalog";
import MapPage from "./pages/map";
import MortgagePage from "./pages/mortgage";
import SelectionPage from "./pages/selection";
import FavoritesPage from "./pages/favorites";
import PartnersPage from "./pages/partners";
import PartnerInvitePage from "./pages/partner-invite";
import {referralCodeFromStart} from "../../../packages/partners/model";
import ProfilePage from "./pages/profile";
import MySearchPage from "./pages/my-search";
import PropertyPage from "./pages/property.$propertyId";
import PrivacyPage from "./pages/privacy";
import PersonalDataConsentPage from "./pages/personal-data-consent";

configureRuntime({enabled:import.meta.env.VITE_PULSE_MODE==="api",base:import.meta.env.VITE_API_BASE_URL,role:"public"});

// start_param only selects the invitation screen; the API validates its owner and buyer identity.
const tg=(window as any).Telegram?.WebApp;
const start=tg?.initDataUnsafe?.start_param||new URLSearchParams(window.location.search).get("tgWebAppStartParam");
const referral=referralCodeFromStart(start);
if(referral)window.location.hash="/partner-invite?code="+encodeURIComponent(referral);
else if(start==="partners")window.location.hash="/partners";

const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});

class ScreenBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<div className="screenLoadState" role="alert"><strong>Не удалось открыть раздел</strong><p>Проверьте соединение и попробуйте снова.</p><button onClick={()=>window.location.reload()}>Обновить приложение</button></div>:this.props.children}
}
function ScreenContent({children}:{children:React.ReactNode}){
 const location=useLocation();
 return <ScreenBoundary key={location.pathname}>{children}</ScreenBoundary>;
}
function App(){
  return <QueryClientProvider client={queryClient}>
    <HashRouter>
      <AppShell>
        <ScreenContent><Routes>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/catalog" element={<CatalogPage/>}/>
          <Route path="/map" element={<MapPage/>}/>
          <Route path="/mortgage" element={<MortgagePage/>}/>
          <Route path="/selection" element={<SelectionPage/>}/>
          <Route path="/favorites" element={<FavoritesPage/>}/>
          <Route path="/journey" element={<JourneyPage/>}/>
          <Route path="/partners" element={<PartnersPage/>}/>
          <Route path="/partner-invite" element={<PartnerInvitePage/>}/>
          <Route path="/profile" element={<ProfilePage/>}/>
          <Route path="/my-search" element={<MySearchPage/>}/>
          <Route path="/privacy" element={<PrivacyPage/>}/>
          <Route path="/personal-data-consent" element={<PersonalDataConsentPage/>}/>
          <Route path="/property/:propertyId" element={<PropertyPage/>}/>
          <Route path="*" element={<HomePage/>}/>
        </Routes></ScreenContent>
      </AppShell>
    </HashRouter>
  </QueryClientProvider>
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><RuntimeGate><App/></RuntimeGate></React.StrictMode>);
