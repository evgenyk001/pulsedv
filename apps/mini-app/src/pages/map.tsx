import React from "react";
import { useNavigate } from "react-router-dom";
export default function MapAliasPage(){const navigate=useNavigate();React.useEffect(()=>{navigate("/catalog?view=map",{replace:true})},[navigate]);return null}
