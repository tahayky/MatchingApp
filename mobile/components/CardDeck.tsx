import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Dimensions, Text } from 'react-native';

import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { SwipeableCard, ProfileData } from './SwipeableCard';

const { width, height } = Dimensions.get('window');

interface CardDeckProps {
  profiles: ProfileData[];
  onSwipeLeft: (profile: ProfileData) => void;
  onSwipeRight: (profile: ProfileData) => void;
  onDeckEmpty: () => void;
}

export function CardDeck({ profiles, onSwipeLeft, onSwipeRight, onDeckEmpty }: CardDeckProps) {
  const [currentProfiles, setCurrentProfiles] = useState<ProfileData[]>([]);
  
  // Initialize with profiles - debug eklenerek
  useEffect(() => {
    console.log(`CardDeck: Profiles prop değişti, yeni uzunluk: ${profiles.length}`);
    if (profiles.length > 0) {
      console.log(`CardDeck: İlk profil: ${profiles[0].name}, ID: ${profiles[0].id}`);
      setCurrentProfiles(profiles);
    }
  }, [profiles]);

  // Boş deste kontrolü - sonsuz döngüyü önlemek için iyileştirildi
  const [hasCalledEmpty, setHasCalledEmpty] = useState<boolean>(false);
  
  useEffect(() => {
    console.log(`CardDeck: currentProfiles uzunluğu: ${currentProfiles.length}`);
    
    // Sadece bir kez onDeckEmpty çağır
    if (currentProfiles.length === 0 && profiles.length === 0 && !hasCalledEmpty) {
      console.log('CardDeck: Gerçekten boş deste tespit edildi, yeni profil isteniyor (bir kez)');
      setHasCalledEmpty(true);
      onDeckEmpty();
    }
    
    // profiles prop'u değiştiğinde hasCalledEmpty'yi sıfırla
    if (profiles.length > 0) {
      setHasCalledEmpty(false);
    }
  }, [currentProfiles, profiles, onDeckEmpty, hasCalledEmpty]);

  const handleSwipeLeft = (profile: ProfileData) => {
    setCurrentProfiles((prevProfiles) => 
      prevProfiles.filter(p => p.id !== profile.id)
    );
    onSwipeLeft(profile);
  };

  const handleSwipeRight = (profile: ProfileData) => {
    console.log('--- CardDeck: Detected right swipe, about to call onSwipeRight prop for:', profile.id);

    // Call the prop function passed from HomeScreen ONCE
    if (onSwipeRight) {
        onSwipeRight(profile);
    }

    // Update local state to remove the card AFTER calling the prop
    setCurrentProfiles((prevProfiles) =>
      prevProfiles.filter(p => p.id !== profile.id)
    );

    // The second call has been removed.
  };

  return (
    <ThemedView style={styles.container}>
      {currentProfiles.length > 0 ? (
        <>
          {/* Only render the top card for better performance */}
          <SwipeableCard
            key={currentProfiles[0].id}
            profile={currentProfiles[0]}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
          />
        </>
      ) : (
        <ThemedView style={styles.emptyDeckContainer}>
          <ThemedText type="title">No more profiles!</ThemedText>
          <ThemedText>Come back later for more matches</ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDeckContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});
