import { useCallback, useEffect, useState } from 'react';
import { fetchCargas } from '../api/importacao';
import { CARGAS_UPDATED_EVENT, countPendingCargas } from '../utils/importacaoView';

export function useImportBadge() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const cargas = await fetchCargas();
      setCount(countPendingCargas(cargas));
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      void refresh();
    };

    handleUpdate();
    window.addEventListener(CARGAS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(CARGAS_UPDATED_EVENT, handleUpdate);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial badge fetch on mount
  }, [refresh]);

  return count;
}
