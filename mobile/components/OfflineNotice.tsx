import React, { useState } from 'react';
import { StyleSheet, Dimensions, Pressable, Animated } from 'react-native';
import { useNetworkStatus } from '@/utils/networkUtils';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { useEffect, useRef } from 'react';

const { width } = Dimensions.get('window');

export function OfflineNotice() {
  const { isConnected, isInternetReachable, recheckConnection } = useNetworkStatus();
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(Date.now());
  const bannerHeight = useRef(new Animated.Value(0)).current;
  
  // Internet bağlantısı olmayabilir ama ağa bağlı olabilir, her iki durumu da kontrol et
  const isOnline = isConnected && isInternetReachable;
  
  // Manuel yeniden kontrol
  const handleRecheck = async () => {
    // Sadece 2 saniyede bir tekrar kontrol etmeye izin ver (spam önleme)
    const now = Date.now();
    if (now - lastCheckTime < 2000) return;
    
    setIsChecking(true);
    setLastCheckTime(now);
    
    try {
      await recheckConnection();
    } finally {
      setIsChecking(false);
    }
  };
  
  // Bağlantı durumu değiştiğinde banner'ı göster/gizle
  useEffect(() => {
    Animated.timing(bannerHeight, {
      toValue: isOnline ? 0 : 50,
      duration: 300,
      useNativeDriver: false
    }).start();
  }, [isOnline]);
  
  // Eğer çevrimiçi isek, banner'ı gizle
  if (isOnline) {
    return null;
  }
  
  // Eğer çevrimdışı isek, sadece bir banner göster (ekranı kilitleme)
  return (
    <Animated.View style={[styles.container, { height: bannerHeight }]}>
      <ThemedView style={styles.banner}>
        <ThemedText style={styles.bannerText}>
          ⚠️ İnternet bağlantısı yok! Yeni içerik yüklenemeyecek.
        </ThemedText>
        <Pressable 
          style={[styles.button, isChecking && styles.buttonDisabled]} 
          onPress={handleRecheck}
          disabled={isChecking}
        >
          <ThemedText style={styles.buttonText}>
            {isChecking ? '...' : 'Kontrol Et'}
          </ThemedText>
        </Pressable>
      </ThemedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(220, 20, 60, 0.9)', // Crimson with opacity
    overflow: 'hidden',
    zIndex: 1000,
  },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    height: 50,
  },
  bannerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginLeft: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  }
});
