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
  likeLoading?: boolean;
}

export function CardDeck({ profiles, onSwipeLeft, onSwipeRight, onDeckEmpty, likeLoading = false }: CardDeckProps) {
  const [currentProfiles, setCurrentProfiles] = useState<ProfileData[]>([]);
  
  // Initialize with profiles - debug eklenerek
  useEffect(() => {
    console.log(`CardDeck: Profiles prop değişti, yeni uzunluk: ${profiles.length}`);
    if (profiles.length > 0) {
      console.log(`CardDeck: İlk profil: ${profiles[0].name}, ID: ${profiles[0].id}`);
      setCurrentProfiles(profiles);
    }
  }, [profiles]);

  // Removed the more complex useEffect for onDeckEmpty.
  // onDeckEmpty will be called directly after a swipe if the deck becomes empty.

  const handleSwipe = (profile: ProfileData, swipeDirection: 'left' | 'right') => {
    // Call the appropriate prop function passed from the parent
    if (swipeDirection === 'left' && onSwipeLeft) {
      onSwipeLeft(profile);
    } else if (swipeDirection === 'right' && onSwipeRight) {
      console.log('--- CardDeck: Detected right swipe, calling onSwipeRight prop for:', profile.id);
      onSwipeRight(profile);
    }

    // Update local state to remove the card
    setCurrentProfiles((prevProfiles) => {
      const newProfiles = prevProfiles.filter(p => p.id !== profile.id);
      if (newProfiles.length === 0) {
        console.log('CardDeck: Deck is now empty after swipe, calling onDeckEmpty.');
        onDeckEmpty(); // Call when the current, actively rendered deck becomes empty
      }
      return newProfiles;
    });
  };
  
  // Specific handlers just call the generic one
  const handleSwipeLeft = (profile: ProfileData) => {
    handleSwipe(profile, 'left');
  };

  const handleSwipeRight = (profile: ProfileData) => {
    handleSwipe(profile, 'right');
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
            disabled={likeLoading}
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
