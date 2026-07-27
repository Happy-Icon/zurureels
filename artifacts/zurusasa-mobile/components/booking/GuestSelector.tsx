import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

const ORANGE = '#F26522';

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
  pets: number;
}

interface GuestRowProps {
  label: string;
  sublabel: string;
  value: number;
  min: number;
  max: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

function GuestRow({ label, sublabel, value, min, max, onIncrement, onDecrement }: GuestRowProps) {
  const canDec = value > min;
  const canInc = value < max;

  return (
    <View style={styles.row}>
      <View style={styles.labelBlock}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sublabel}>{sublabel}</Text>
      </View>

      <View style={styles.counter}>
        <Pressable
          onPress={onDecrement}
          disabled={!canDec}
          hitSlop={8}
          style={({ pressed }) => [
            styles.counterBtn,
            !canDec && styles.counterBtnDisabled,
            pressed && canDec && styles.counterBtnPressed,
          ]}
        >
          <Feather name="minus" size={14} color={canDec ? '#222222' : '#D1D5DB'} />
        </Pressable>

        <Text style={styles.counterValue}>{value}</Text>

        <Pressable
          onPress={onIncrement}
          disabled={!canInc}
          hitSlop={8}
          style={({ pressed }) => [
            styles.counterBtn,
            !canInc && styles.counterBtnDisabled,
            pressed && canInc && styles.counterBtnPressed,
          ]}
        >
          <Feather name="plus" size={14} color={canInc ? '#222222' : '#D1D5DB'} />
        </Pressable>
      </View>
    </View>
  );
}

interface GuestSelectorProps {
  guests: GuestCounts;
  maxGuests?: number;
  onChange: (guests: GuestCounts) => void;
}

export function GuestSelector({ guests, maxGuests = 20, onChange }: GuestSelectorProps) {
  const totalGuests = guests.adults + guests.children;

  const update = (key: keyof GuestCounts, delta: number) => {
    const next = { ...guests, [key]: guests[key] + delta };
    onChange(next);
  };

  return (
    <View style={styles.container}>
      <GuestRow
        label="Adults"
        sublabel="Age 13+"
        value={guests.adults}
        min={1}
        max={maxGuests}
        onDecrement={() => update('adults', -1)}
        onIncrement={() => update('adults', 1)}
      />
      <View style={styles.divider} />
      <GuestRow
        label="Children"
        sublabel="Ages 2–12"
        value={guests.children}
        min={0}
        max={maxGuests - guests.adults}
        onDecrement={() => update('children', -1)}
        onIncrement={() => update('children', 1)}
      />
      <View style={styles.divider} />
      <GuestRow
        label="Infants"
        sublabel="Under 2"
        value={guests.infants}
        min={0}
        max={5}
        onDecrement={() => update('infants', -1)}
        onIncrement={() => update('infants', 1)}
      />
      <View style={styles.divider} />
      <GuestRow
        label="Pets"
        sublabel="Bringing a pet?"
        value={guests.pets}
        min={0}
        max={3}
        onDecrement={() => update('pets', -1)}
        onIncrement={() => update('pets', 1)}
      />

      {totalGuests >= maxGuests ? (
        <View style={styles.maxNotice}>
          <Feather name="info" size={13} color={ORANGE} />
          <Text style={styles.maxNoticeText}>
            Maximum {maxGuests} guests allowed for this experience.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  labelBlock: {
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  sublabel: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  counterBtnDisabled: {
    borderColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  counterBtnPressed: {
    backgroundColor: '#F3F4F6',
  },
  counterValue: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    minWidth: 20,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  maxNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFBF8',
    borderTopWidth: 1,
    borderTopColor: '#FCE3D6',
  },
  maxNoticeText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#F26522',
    flex: 1,
  },
});
