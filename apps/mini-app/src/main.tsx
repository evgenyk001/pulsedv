import {PartnerSecurityGate} from './components/PartnerSecurity';
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
const JourneyPage=React.lazy(()=>import('./pages/journey'));
import CatalogPage from './pages/catalog';
const MapPage=React.lazy(()=>import('./pages/map'));
import MortgagePage from './pages/mortgage';
import SelectionPage from './pages/selection';
import FavoritesPage from './pages/favorites';
const PartnersPage=React.lazy(()=>import('./pages/partners'));
const PartnerOfferPage=React.lazy(()=>import('./pages/partner-offer'));
const PartnerInvitePage=React.lazy(()=>import('./pages/partner-invite'));
import {referralCodeFromStart} from "../../../packages/partners/model";
const ProfilePage=React.lazy(()=>import('./pages/profile'));
const MySearchPage=React.lazy(()=>import('./pages/my-search'));
const PropertyPage=React.lazy(()=>import('./pages/property.$propertyId'));
const PrivacyPage=React.lazy(()=>import('./pages/privacy'));
const PersonalDataConsentPage=React.lazy(()=>import('./pages/personal-data-consent'));

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
        <ScreenContent><React.Suspense fallback={<div className="screenLoadState" role="status">Открываем раздел…</div>}><Routes>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/catalog" element={<CatalogPage/>}/>
          <Route path="/map" element={<MapPage/>}/>
          <Route path="/mortgage" element={<MortgagePage/>}/>
          <Route path="/selection" element={<SelectionPage/>}/>
          <Route path="/favorites" element={<FavoritesPage/>}/>
          <Route path="/journey" element={<JourneyPage/>}/>
          <Route path="/partner-offer" element={<PartnerOfferPage/>}/>
          <Route path="/partners" element={<PartnerSecurityGate><PartnersPage/></PartnerSecurityGate>}/>
          <Route path="/partner-invite" element={<PartnerInvitePage/>}/>
          <Route path="/profile" element={<ProfilePage/>}/>
          <Route path="/my-search" element={<MySearchPage/>}/>
          <Route path="/privacy" element={<PrivacyPage/>}/>
          <Route path="/personal-data-consent" element={<PersonalDataConsentPage/>}/>
          <Route path="/property/:propertyId" element={<PropertyPage/>}/>
          <Route path="*" element={<HomePage/>}/>
        </Routes></React.Suspense></ScreenContent>
      </AppShell>
    </HashRouter>
  </QueryClientProvider>
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><RuntimeGate><App/></RuntimeGate></React.StrictMode>);
