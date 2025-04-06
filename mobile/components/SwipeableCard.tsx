import React from 'react';
import {
  StyleSheet,
  Image,
  Dimensions,
  ImageSourcePropType,
  View,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  interpolate,
  Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.9;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.6;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

export interface ProfileData {
  id: string;
  name: string;
  age: number;
  image: ImageSourcePropType;
  bio: string;
  distance: string;
}

interface SwipeableCardProps {
  profile: ProfileData;
  onSwipeLeft: (profile: ProfileData) => void;
  onSwipeRight: (profile: ProfileData) => void;
}

export function SwipeableCard({ profile, onSwipeLeft, onSwipeRight }: SwipeableCardProps) {
  // Güvenlik kontrolü - profil objesi geçerli mi?
  console.log(`SwipeableCard: Profil render ediliyor: ${profile.name}`);
  console.log(`SwipeableCard: Profil resmi:`, profile.image);
  
  const colorScheme = useColorScheme() ?? 'light';
  const translateX = useSharedValue(0);
  const rotation = useSharedValue(0);

  const handleSwipeLeft = () => {
    onSwipeLeft(profile);
  };

  const handleSwipeRight = () => {
    onSwipeRight(profile);
  };

  const panGestureEvent = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.startX + event.translationX;
      rotation.value = interpolate(
        translateX.value,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-15, 0, 15],
        Extrapolate.CLAMP
      );
    },
    onEnd: (event) => {
      if (translateX.value < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5);
        runOnJS(handleSwipeLeft)();
      } else if (translateX.value > SWIPE_THRESHOLD) {
        translateX.value = withSpring(SCREEN_WIDTH * 1.5);
        runOnJS(handleSwipeRight)();
      } else {
        translateX.value = withSpring(0);
        rotation.value = withSpring(0);
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { rotateZ: `${rotation.value}deg` },
      ],
    };
  });

  const likeOpacityStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        translateX.value,
        [0, SWIPE_THRESHOLD],
        [0, 1],
        Extrapolate.CLAMP
      ),
    };
  });

  const nopeOpacityStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        translateX.value,
        [-SWIPE_THRESHOLD, 0],
        [1, 0],
        Extrapolate.CLAMP
      ),
    };
  });

  return (
    <PanGestureHandler onGestureEvent={panGestureEvent}>
      <Animated.View style={[styles.cardContainer, cardStyle]}>
        <Image source={profile.image} style={styles.image} />
        
        <Animated.View style={[styles.overlayLike, likeOpacityStyle]}>
          <View style={[styles.badgeContainer, styles.likeBadge]}>
            <ThemedText style={styles.badgeText}>LIKE</ThemedText>
          </View>
        </Animated.View>
        
        <Animated.View style={[styles.overlayNope, nopeOpacityStyle]}>
          <View style={[styles.badgeContainer, styles.nopeBadge]}>
            <ThemedText style={styles.badgeText}>NOPE</ThemedText>
          </View>
        </Animated.View>
        
        <ThemedView style={styles.infoContainer}>
          <ThemedText type="title">{profile.name}, {profile.age}</ThemedText>
          <ThemedText>{profile.distance}</ThemedText>
          <ThemedText style={styles.bio}>{profile.bio}</ThemedText>
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.nopeButton]} 
              onPress={() => {
                translateX.value = withSpring(-SCREEN_WIDTH * 1.5);
                handleSwipeLeft();
              }}
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.likeButton]} 
              onPress={() => {
                translateX.value = withSpring(SCREEN_WIDTH * 1.5);
                handleSwipeRight();
              }}
            >
              <Ionicons name="heart" size={30} color="white" />
            </TouchableOpacity>
          </View>
        </ThemedView>
      </Animated.View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    backgroundColor: 'white',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  image: {
    width: '100%',
    height: '70%',
    resizeMode: 'cover',
  },
  infoContainer: {
    padding: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  bio: {
    marginTop: 5,
    marginBottom: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nopeButton: {
    backgroundColor: '#FF6B6B',
  },
  likeButton: {
    backgroundColor: '#4CD964',
  },
  overlayLike: {
    position: 'absolute',
    top: 50,
    right: 40,
    zIndex: 1,
    transform: [{ rotate: '15deg' }],
  },
  overlayNope: {
    position: 'absolute',
    top: 50,
    left: 40,
    zIndex: 1,
    transform: [{ rotate: '-15deg' }],
  },
  badgeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 4,
    borderRadius: 10,
  },
  likeBadge: {
    borderColor: '#4CD964',
  },
  nopeBadge: {
    borderColor: '#FF6B6B',
  },
  badgeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
