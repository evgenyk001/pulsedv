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
const CatalogPage=React.lazy(()=>import("./pages/catalog"));
const MapPage=React.lazy(()=>import("./pages/map"));
const MortgagePage=React.lazy(()=>import("./pages/mortgage"));
const SelectionPage=React.lazy(()=>import("./pages/selection"));
const FavoritesPage=React.lazy(()=>import("./pages/favorites"));
const ProfilePage=React.lazy(()=>import("./pages/profile"));
const PropertyPage=React.lazy(()=>import("./pages/property.$propertyId"));
const PrivacyPage=React.lazy(()=>import("./pages/privacy"));
const PersonalDataConsentPage=React.lazy(()=>import("./pages/personal-data-consent"));

configureRuntime({enabled:import.meta.env.VITE_PULSE_MODE==="api",base:import.meta.env.VITE_API_BASE_URL,role:"public"});

const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});

class ScreenBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<div className="screenLoadState" role="alert"><strong>Не удалось открыть раздел</strong><p>Проверьте соединение и попробуйте снова.</p><button onClick={()=>window.location.reload()}>Обновить приложение</button></div>:this.props.children}
}
function ScreenContent({children}:{children:React.ReactNode}){
 const location=useLocation();
 return <ScreenBoundary key={location.pathname}><React.Suspense fallback={<div className="screenLoadState" role="status" aria-live="polite">Открываем раздел…</div>}>{children}</React.Suspense></ScreenBoundary>;
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
          <Route path="/profile" element={<ProfilePage/>}/>
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
