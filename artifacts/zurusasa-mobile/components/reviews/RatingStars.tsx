import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RatingStarsProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  color?: string;
  emptyColor?: string;
}

export function RatingStars({
  rating,
  size = 18,
  interactive = false,
  onRatingChange,
  color = '#F26522',
  emptyColor = '#EBEBEB',
}: RatingStarsProps) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={styles.container}>
      {stars.map((starIndex) => {
        const isFilled = starIndex <= Math.round(rating);

        if (interactive) {
          return (
            <Pressable
              key={starIndex}
              onPress={() => onRatingChange?.(starIndex)}
              hitSlop={8}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons
                name={isFilled ? 'star' : 'star-outline'}
                size={size}
                color={isFilled ? color : emptyColor}
              />
            </Pressable>
          );
        }

        return (
          <Ionicons
            key={starIndex}
            name={isFilled ? 'star' : 'star-outline'}
            size={size}
            color={isFilled ? color : emptyColor}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
