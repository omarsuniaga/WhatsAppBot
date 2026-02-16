/**
 * useViewInfo - Hook personalizado para obtener información de vista
 * Simplifica el acceso a las descripciones de ayuda desde cualquier componente
 */

import { useMemo } from 'react';
import { VIEW_DESCRIPTIONS, ViewInfo } from '../utils/viewDescriptions';

export const useViewInfo = (viewKey: string): ViewInfo | null => {
  return useMemo(() => {
    return VIEW_DESCRIPTIONS[viewKey] || null;
  }, [viewKey]);
};

/**
 * Hook para usar fácilmente en componentes
 * Retorna tanto la información como un booleano indicando si existe
 */
export const usePageInfo = (pageKey: string) => {
  const info = useViewInfo(pageKey);
  return {
    info,
    hasInfo: !!info,
    title: info?.title || '',
    description: info?.description || '',
    tips: info?.tips || [],
  };
};
