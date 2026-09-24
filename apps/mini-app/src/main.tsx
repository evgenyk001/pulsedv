import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./base.css";
import { AppShell } from "./components/AppShell";
import HomePage from "./pages/_index";
import CatalogPage from "./pages/catalog";
import MapPage from "./pages/map";
import MortgagePage from "./pages/mortgage";
import SelectionPage from "./pages/selection";
import FavoritesPage from "./pages/favorites";
import ProfilePage from "./pages/profile";
import PropertyPage from "./pages/property.$propertyId";

const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});

function App(){
  return <QueryClientProvider client={queryClient}>
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/catalog" element={<CatalogPage/>}/>
          <Route path="/map" element={<MapPage/>}/>
          <Route path="/mortgage" element={<MortgagePage/>}/>
          <Route path="/selection" element={<SelectionPage/>}/>
          <Route path="/favorites" element={<FavoritesPage/>}/>
          <Route path="/profile" element={<ProfilePage/>}/>
          <Route path="/property/:propertyId" element={<PropertyPage/>}/>
          <Route path="*" element={<HomePage/>}/>
        </Routes>
      </AppShell>
    </HashRouter>
  </QueryClientProvider>
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
