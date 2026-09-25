import React from 'react';
import { useProperties } from './useProperties';
import { priceBounds } from '../../../../packages/domain/propertyMatch';
export function usePriceBounds(){const {data:properties,isLoading,error}=useProperties();const data=React.useMemo(()=>properties?priceBounds(properties):undefined,[properties]);return {data,isLoading,error};}
