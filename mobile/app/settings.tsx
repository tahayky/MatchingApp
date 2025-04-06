import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Switch,
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import apiUrlManager from '@/utils/apiUrlManager';

export default function SettingsScreen() {
  const router = useRouter();
  const [deviceUrl, setDeviceUrl] = useState('');
  const [useDeviceUrl, setUseDeviceUrl] = useState(false);
  const [loading, setLoading] = useState(true);

  // Mevcut ayarları yükle
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Fiziksel cihaz URL ayarını yükle
        const storedUseDeviceUrl = await AsyncStorage.getItem('USE_DEVICE_URL');
        if (storedUseDeviceUrl === 'true') {
          setUseDeviceUrl(true);
        }
        
        // Özel cihaz URL'sini yükle
        const storedDeviceUrl = await AsyncStorage.getItem('CUSTOM_DEVICE_URL');
        if (storedDeviceUrl) {
          setDeviceUrl(storedDeviceUrl.replace('/api', ''));
        } else {
          // Varsayılan değer
          setDeviceUrl('http://192.168.1.105:3000');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  // API URL ayarlarını kaydet
  const saveSettings = async () => {
    try {
      // URL'nin http:// ile başladığından emin ol
      let formattedUrl = deviceUrl;
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'http://' + formattedUrl;
      }
      
      // URL'nin port numarasını içerdiğinden emin ol (varsayılan 3000)
      if (!formattedUrl.match(/:\d+$/)) {
        formattedUrl = formattedUrl + ':3000';
      }
      
      // URL ayarlarını kaydet
      await apiUrlManager.setCustomDeviceUrl(formattedUrl);
      await apiUrlManager.setUseDeviceUrl(useDeviceUrl);
      
      Alert.alert(
        'Ayarlar Kaydedildi', 
        `API URL ${useDeviceUrl ? 'fiziksel cihaz URL\'sine ayarlandı' : 'platform varsayılanına ayarlandı'}.`,
        [{ text: 'Tamam', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Hata', 'Ayarlar kaydedilirken bir hata oluştu.');
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText>Ayarlar yükleniyor...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.headerTitle}>API Ayarları</ThemedText>
          </ThemedView>
          
          <ThemedView style={styles.form}>
            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Fiziksel Cihaz API URL'si</ThemedText>
              <ThemedText style={styles.description}>
                Gerçek bir cihazda test yaparken kullanılacak API sunucusunun adresini girin.
                Bilgisayarınızın IP adresi ve port numarası olmalıdır.
              </ThemedText>
              <TextInput
                style={styles.input}
                placeholder="örn. 192.168.1.105:3000"
                value={deviceUrl}
                onChangeText={setDeviceUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </ThemedView>
            
            <ThemedView style={styles.switchContainer}>
              <ThemedText style={styles.label}>Fiziksel Cihaz URL'sini Kullan</ThemedText>
              <ThemedText style={styles.description}>
                Bu seçeneği etkinleştirdiğinizde, uygulama platform varsayılan değerleri yerine
                yukarıda belirttiğiniz URL'yi kullanacaktır.
              </ThemedText>
              <ThemedView style={styles.switchRow}>
                <ThemedText>{useDeviceUrl ? 'Açık' : 'Kapalı'}</ThemedText>
                <Switch
                  value={useDeviceUrl}
                  onValueChange={setUseDeviceUrl}
                />
              </ThemedView>
            </ThemedView>
            
            <ThemedView style={styles.infoContainer}>
              <ThemedText type="defaultSemiBold">Geçerli Platform Varsayılanları:</ThemedText>
              <ThemedText>iOS Simülatörü: http://localhost:3000/api</ThemedText>
              <ThemedText>Android Emülatörü: http://10.0.2.2:3000/api</ThemedText>
            </ThemedView>
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={saveSettings}
            >
              <ThemedText style={styles.buttonText}>Ayarları Kaydet</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={() => router.back()}
            >
              <ThemedText style={styles.buttonText}>İptal</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    marginBottom: 10,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    marginBottom: 8,
    opacity: 0.7,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  switchContainer: {
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  infoContainer: {
    marginVertical: 20,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
