import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Dimensions, Text, Image } from 'react-native';

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
        <View style={styles.deckContainer}>
          {/* Show actual next profiles as background cards */}
          {currentProfiles.slice(1, 4).reverse().map((profile, index) => (
            <View
              key={`background-${profile.id}`}
              style={[
                styles.backgroundCard,
                {
                  transform: [
                    { scale: 1 - (index + 1) * 0.06 }, // Progressive size reduction
                    { translateY: (index + 1) * 8 }, // Stack cards downward
                  ],
                  zIndex: 10 - (index + 1), // Layer cards properly
                }
              ]}
            >
              <Image
                source={profile.image}
                style={styles.backgroundCardImage}
              />
            </View>
          ))}
          
          {/* Main interactive card */}
          <View style={styles.mainCardContainer}>
            <SwipeableCard
              key={currentProfiles[0].id}
              profile={currentProfiles[0]}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              disabled={likeLoading}
            />
          </View>
        </View>
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
  deckContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 15,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 25,
  },
  backgroundCard: {
    position: 'absolute',
    width: width * 0.9,
    height: height * 0.6,
    borderRadius: 20,
    backgroundColor: '#e8e8e8',
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 15,
    overflow: 'hidden',
  },
  backgroundCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    opacity: 0.7,
  },
  mainCardContainer: {
    zIndex: 20,
    position: 'relative',
  },
  emptyDeckContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});
