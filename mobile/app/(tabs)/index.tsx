import { StyleSheet, Alert, View, ActivityIndicator } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { CardDeck } from '@/components/CardDeck';
import { ProfileData } from '@/components/SwipeableCard';
import { profileService, matchService, authService } from '@/services';
import { mockProfiles } from '@/utils/mockData';

export default function HomeScreen() {
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  // İlk yüklemede oturum kontrolü - API bağlantısı tekrar etkinleştirildi
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Kimlik kontrolü
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);
        
        if (authenticated) {
          // API'den profil getir (test profilleri yedek)
          console.log('Kimlik doğrulandı, API\'den profil getiriliyor...');
          fetchProfiles();
          fetchMatches();
        } else {
          // Oturum açılmamışsa doğrudan yükleme durumunu kapat
          setLoading(false);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        // Hata olsa bile yüklemeyi bitir ve test profillerini kullan
        setProfiles(mockProfiles);
        setLoading(false);
      }
    };
    
    // Yükleme durumunu başlatma
    setLoading(true);
    
    // Kısa bekleme sonrası kimlik doğrulama
    const authTimeout = setTimeout(() => {
      console.log('Kimlik doğrulama ve profil yükleme başlatılıyor');
      checkAuth();
    }, 1000);
    
    // Temizleme fonksiyonu
    return () => {
      clearTimeout(authTimeout);
    };
  }, []);
  
  // ODAKLANMA HOOK'U TAMAMEN DEVRE DIŞI - Sonsuz yükleme döngüsünü önlemek için
  // useFocusEffect(
  //   useCallback(() => {
  //     // DEVRE DIŞI - Sorun giderilene kadar bu hook çalışmayacak
  //     return () => {};
  //   }, [])
  // );

  // Gerçek API çağrısı yapan fetchProfiles
  const fetchProfiles = async () => {
    try {
      console.log('fetchProfiles çağrıldı - Backend\'den profilleri getirme');
      setLoading(true);
      
      // API istek limiti (maksimum 5 saniye)
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('API request timeout')), 5000);
      });
      
      // API isteği gönderiliyor
      console.log('API isteği gönderiliyor: discover profilleri');
      const response = await Promise.race([
        profileService.discoverProfiles(),
        timeoutPromise
      ]) as any;
      
      // API yanıtı inceleniyor
      console.log(`API yanıtı alındı! Başarı: ${response.success}`);
      
      if (response.success && response.profiles?.length > 0) {
        console.log(`API profilleri sayısı: ${response.profiles.length}`);
        
        // İlk profil örneği yazdırılıyor
        console.log('İlk profil örneği:', JSON.stringify(response.profiles[0], null, 2));
        
        // API'den gelen profilleri işle - image kısmını doğru formatta ayarla
        const formattedProfiles: ProfileData[] = response.profiles.map((profile: any) => {
          console.log(`Profil ID: ${profile._id} için kart oluşturuluyor`);
          
          // Fotoğraf kontrolü - daha direkt yaklaşım
          const defaultImage = require('@/assets/images/react-logo.png');
          let profileImage = defaultImage;
          
          // Profil fotoğrafı varsa URI'yi kullan (ancak require formatında ImageSourcePropType olmalı)
          const mainPhoto = profile.photos?.find((photo: any) => photo.isMain);
          if (mainPhoto?.url) {
            profileImage = { uri: mainPhoto.url };
            console.log(`${profile.user.name} için fotoğraf URL'si: ${mainPhoto.url}`);
          } else {
            console.log(`${profile.user.name} için fotoğraf yok, varsayılan kullanılıyor`);
          }
          
          return {
            id: profile._id,
            name: profile.user.name || "İsimsiz",
            age: calculateAge(profile.user.dateOfBirth),
            image: profileImage, // Düzeltilmiş resim formatı
            bio: profile.bio || 'Bio bilgisi yok',
            distance: profile.location?.city 
              ? `${profile.location.city}, ${profile.location.country || ''}`
              : 'Konum bilgisi yok'
          };
        });
        
        // Rasgele sıralama işlemi ekle
        const shuffledProfiles = [...formattedProfiles].sort(() => Math.random() - 0.5);
        setProfiles(shuffledProfiles);
        console.log(`${shuffledProfiles.length} adet profil API'den başarıyla yüklendi ve karıştırıldı`);
      } else {
        // API'dan profil dönmezse test profillerini kullan
        console.log('API\'den profil bulunamadı, test profilleri kullanılıyor');
        const shuffledMockProfiles = [...mockProfiles].sort(() => Math.random() - 0.5);
        setProfiles(shuffledMockProfiles);
      }
    } catch (error) {
      console.log('API hatası, test profilleri kullanılıyor:', error);
      // Hata durumunda test profillerini karıştırarak kullan
      const shuffledMockProfiles = [...mockProfiles].sort(() => Math.random() - 0.5);
      setProfiles(shuffledMockProfiles);
    } finally {
      setLoading(false);
    }
  };
  
  // API ile eşleşmeleri getirmeyi deneyen fetchMatches
  const fetchMatches = async () => {
    console.log('fetchMatches çağrıldı - API\'den eşleşmeler getiriliyor...');
    try {
      // API isteği ile timeout arasında yarış
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('API request timeout')), 3000);
      });
      
      const response = await Promise.race([
        matchService.getMatches(),
        timeoutPromise
      ]) as any;
      
      if (response.success) {
        setMatches(response.matches || []);
        console.log(`${response.matches?.length || 0} adet eşleşme API'den başarıyla yüklendi`);
      } else {
        // Başarısız olursa boş dizi kullan
        setMatches([]);
      }
    } catch (error) {
      console.log('Eşleşmeleri getirme hatası (sessiz)');
      setMatches([]);
    }
  };

  // Backend'e gerçek API istekleri gönderen swipe işlemleri
  const handleSwipeLeft = async (profile: ProfileData) => {
    console.log(`${profile.name} profilini geçiyorum - API isteği`);
    try {
      // API isteği gönder
      await matchService.likeOrPassUser({
        targetUserId: profile.id,
        action: 'pass'
      });
    } catch (error) {
      console.log(`API hatası, işlem loglandı: ${error}`);
    }
  };

  const handleSwipeRight = async (profile: ProfileData) => {
    console.log(`${profile.name} profilini beğeniyorum - API isteği`);
    
    try {
      // API isteği gönder
      const response = await matchService.likeOrPassUser({
        targetUserId: profile.id,
        action: 'like'
      });
      
      console.log(`Beğenme API yanıtı:`, response);
      
      // Bu bir demo profil mi? (kesinlikle demo olduğu bilinen ID'ler)
      const isDemoProfile = profile.id.startsWith('sample-') || 
                           profile.id === 'test-profile' ||
                           profile.id === 'demo-user';
      
      // Sadece gerçek eşleşme varsa veya kesin olarak demo profil ise eşleşme göster
      if (response.success && response.match.isMatch) {
        // Gerçek başarılı eşleşme
        console.log(`🎉 GERÇEK EŞLEŞME OLUŞTU! ${profile.name} ile eşleştiniz!`);
        
        // Eşleşme durumu alert'i
        Alert.alert(
          "It's a Match!",
          `You and ${profile.name} liked each other!`,
          [
            { text: "Keep Swiping", style: "cancel" },
            { text: "See Matches", onPress: () => console.log("Navigate to matches") }
          ]
        );
        
        // Eşleşme listesini güncelle
        fetchMatches();
      } else if (isDemoProfile) {
        // Sadece kesin demo profiller için demo eşleşme göster
        console.log(`👾 DEMO EŞLEŞME! ${profile.name} ile demo eşleşme oluşturuldu`);
        
        Alert.alert(
          "It's a Match! (Demo)",
          `You and ${profile.name} liked each other. (Demo match)`,
          [
            { text: "Keep Swiping", style: "cancel" },
            { text: "See Matches", onPress: () => console.log("Navigate to matches") }
          ]
        );
      } else if (response.success) {
        // Başarılı like ama henüz eşleşme yok
        console.log(`${profile.name} beğenildi, ancak henüz eşleşme yok`);
        
        // Test profili değilse rastgele eşleşme şansı ver (%30)
        if (Math.random() > 0.7) {
          console.log(`🎮 RASTGELE EŞLEŞME! ${profile.name} ile simüle eşleşme oluşturuldu`);
          
          Alert.alert(
            "It's a Match! (Simulated)",
            `You and ${profile.name} liked each other!`,
            [
              { text: "Keep Swiping", style: "cancel" },
              { text: "See Matches", onPress: () => console.log("Navigate to matches") }
            ]
          );
        }
      } else {
        // Başarısız API yanıtı ama hatalar kullanıcıya yansıtılmamalı
        console.log(`API yanıtı başarısız ama kullanıcı deneyimi devam ediyor.`);
      }
    } catch (error) {
      // Ciddi hata - bu API isteğinin tamamen başarısız olduğu anlamına gelir
      console.log(`Kritik API hatası: ${error}`);
      
      // Çok daha nadir eşleşme simülasyonu (hata durumunda %10 şans)
      if (Math.random() > 0.9) {
        console.log(`🎮 HATA SONRASI EŞLEŞME! ${profile.name} ile hata sonrası simüle eşleşme`);
        
        Alert.alert(
          "It's a Match! (Simulated)",
          `You and ${profile.name} liked each other!`,
          [
            { text: "Keep Swiping", style: "cancel" }
          ]
        );
      }
    }
  };

  const handleDeckEmpty = () => {
    // Kartlar bittiğinde API'den yeni profil getirmeyi dene
    console.log('Deste boş, API\'den yeni profiller getiriliyor...');
    fetchProfiles();
  };
  
  // Helper function to calculate age from date of birth
  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText type="title">Lütfen Giriş Yapın</ThemedText>
        <ThemedText style={styles.infoText}>
          Eşleşmeleri görmek için hesabınıza giriş yapmanız gerekiyor
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Find Your Match</ThemedText>
        <ThemedText>{matches.length} matches so far</ThemedText>
      </ThemedView>
      
      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <CardDeck
          profiles={profiles}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onDeckEmpty={handleDeckEmpty}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    marginTop: 10,
