import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { AgentRegion, AgentReseller } from '../types';
import {
  filterResellersByRegion,
  loadStoredOperationalRegionId,
  loadStoredOperationalResellerId,
  saveStoredOperationalRegionId,
  saveStoredOperationalResellerId,
} from '../utils/operationalFilters';

export function useOperationalFilters(enabled: boolean, onFilterChange?: () => void) {
  const [selectedOperationalRegionId, setSelectedOperationalRegionId] = useState('');
  const [selectedOperationalResellerId, setSelectedOperationalResellerId] = useState('');

  const { data: myResellers = [] } = useQuery<AgentReseller[]>({
    queryKey: ['myResellers'],
    queryFn: () => apiService.getMyResellers(),
    enabled,
    retry: false,
  });

  const { data: myRegions = [] } = useQuery<AgentRegion[]>({
    queryKey: ['myRegions'],
    queryFn: () => apiService.getMyRegions(true),
    enabled,
    retry: false,
  });

  useEffect(() => {
    if (!enabled) return;
    setSelectedOperationalRegionId(loadStoredOperationalRegionId());
    setSelectedOperationalResellerId(loadStoredOperationalResellerId());
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const regionExists =
      !selectedOperationalRegionId || myRegions.some((r) => r.id === selectedOperationalRegionId);
    if (!regionExists) {
      setSelectedOperationalRegionId('');
      saveStoredOperationalRegionId('');
    }
    const resellerExists =
      !selectedOperationalResellerId || myResellers.some((r) => r.id === selectedOperationalResellerId);
    if (!resellerExists) {
      setSelectedOperationalResellerId('');
      saveStoredOperationalResellerId('');
    }
  }, [enabled, myRegions, myResellers, selectedOperationalRegionId, selectedOperationalResellerId]);

  const filteredOperationalResellers = useMemo(
    () => filterResellersByRegion(myResellers, selectedOperationalRegionId),
    [myResellers, selectedOperationalRegionId]
  );

  const handleRegionSelect = (regionId: string) => {
    const next = selectedOperationalRegionId === regionId ? '' : regionId;
    setSelectedOperationalRegionId(next);
    saveStoredOperationalRegionId(next);
    setSelectedOperationalResellerId('');
    saveStoredOperationalResellerId('');
    onFilterChange?.();
  };

  const handleResellerSelect = (resellerId: string) => {
    const next = selectedOperationalResellerId === resellerId ? '' : resellerId;
    setSelectedOperationalResellerId(next);
    saveStoredOperationalResellerId(next);
    if (next) {
      const match = myResellers.find((r) => r.id === next);
      if (match?.regionId && match.regionId !== selectedOperationalRegionId) {
        setSelectedOperationalRegionId(match.regionId);
        saveStoredOperationalRegionId(match.regionId);
      }
    }
    onFilterChange?.();
  };

  const showOperationalFilters = enabled && (myRegions.length > 0 || myResellers.length > 0);

  return {
    myRegions,
    myResellers,
    filteredOperationalResellers,
    selectedOperationalRegionId,
    selectedOperationalResellerId,
    handleRegionSelect,
    handleResellerSelect,
    showOperationalFilters,
  };
}
