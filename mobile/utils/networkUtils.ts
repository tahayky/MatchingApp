import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useState, useEffect, useCallback } from 'react';

/**
 * Mevcut ağ durumunu almak için kullanılacak ağ yardımcı fonksiyonları
 */

// Varsayılan ağ durum değeri
const DEFAULT_CONNECTION_STATUS = {
  isConnected: false,
  isInternetReachable: false,
  details: null
};

/**
 * Internet bağlantısı kontrolü yapar
 * @returns Internet bağlantısı durumu (boolean)
 */
export const checkInternetConnection = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return !!state.isConnected && !!state.isInternetReachable;
  } catch (error) {
    console.error('Internet bağlantısı kontrolünde hata:', error);
    return false;
  }
};

/**
 * Ağ durumunu izlemek için React hook
 * @returns Ağ durumu ve yeniden kontrol fonksiyonu
 */
export const useNetworkStatus = () => {
  const [networkState, setNetworkState] = useState<NetInfoState>(DEFAULT_CONNECTION_STATUS as NetInfoState);
  
  // Ağ durumunun değişimini izle
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState(state);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Manuel olarak yeniden kontrol yapmak için
  const recheckConnection = useCallback(async () => {
    const state = await NetInfo.fetch();
    setNetworkState(state);
    return state.isConnected && state.isInternetReachable;
  }, []);
  
  return {
    isConnected: networkState.isConnected,
    isInternetReachable: networkState.isInternetReachable,
    connectionType: networkState.type,
    details: networkState.details,
    recheckConnection
  };
};
