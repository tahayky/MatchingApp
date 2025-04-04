import { ProfileData } from '@/components/SwipeableCard';

// Since we don't have actual profile images in the assets, we'll use require statements
// that would normally point to profile images, but we'll use the existing images for demo
// In a real app, you would replace these with actual profile images
export const mockProfiles: ProfileData[] = [
  {
    id: '1',
    name: 'Emma',
    age: 27,
    image: require('@/assets/images/react-logo.png'),
    bio: 'Software developer who loves hiking and coffee. Looking for someone to share adventures with!',
    distance: '3 km away'
  },
  {
    id: '2',
    name: 'Alex',
    age: 29,
    image: require('@/assets/images/react-logo.png'),
    bio: 'Photographer and travel enthusiast. Always planning my next trip!',
    distance: '5 km away'
  },
  {
    id: '3',
    name: 'Sophia',
    age: 25,
    image: require('@/assets/images/react-logo.png'),
    bio: 'Medical student by day, foodie by night. Let\'s explore the best restaurants in town!',
    distance: '2 km away'
  },
  {
    id: '4',
    name: 'Daniel',
    age: 31,
    image: require('@/assets/images/react-logo.png'),
    bio: 'Fitness coach and nutrition expert. I can help you get in shape or we can just grab a beer.',
    distance: '4 km away'
  },
  {
    id: '5',
    name: 'Olivia',
    age: 26,
    image: require('@/assets/images/react-logo.png'),
    bio: 'Art curator with a passion for indie music. Looking for concert buddies and meaningful conversations.',
    distance: '1 km away'
  },
];
