import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { daysUntilNumber } from './reservationHelpers';
import { reservationsStyles as styles } from './reservationsStyles';

export function TripProgressTimeline({
  status,
  checkIn,
  checkedInAt,
  arrivalIssueStatus,
}: {
  status: string | null;
  checkIn: string | null;
  checkedInAt?: string | null;
  arrivalIssueStatus?: string | null;
}) {
  const days = daysUntilNumber(checkIn);
  const s = (status ?? 'pending').toLowerCase();
  const isPaid = s === 'paid' || s === 'confirmed';

  let activeStep = 1; // 0: Booked, 1: Confirmed, 2: Check In, 3: Stay
  if (s === 'completed' || Boolean(checkedInAt)) {
    activeStep = 3; // Check In completed, Stay active
  } else if (arrivalIssueStatus === 'open') {
    activeStep = 2; // Paused at Check In under issue review
  } else if (isPaid) {
    if (days !== null && days <= 0) activeStep = 2; // Check In window
    else activeStep = 1; // Confirmed
  }

  const steps = ['Booked', 'Confirmed', 'Check In', 'Stay'];

  return (
    <View style={styles.timelineWrap}>
      <View style={styles.timelineTrack}>
        <View
          style={[
            styles.timelineFill,
            { width: `${(activeStep / (steps.length - 1)) * 100}%` },
          ]}
        />
      </View>

      <View style={styles.timelineSteps}>
        {steps.map((label, idx) => {
          const isDone = idx <= activeStep;
          const isCurrent = idx === activeStep;
          return (
            <View key={label} style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineDot,
                  isDone && styles.timelineDotDone,
                  isCurrent && styles.timelineDotCurrent,
                ]}
              >
                {isDone ? (
                  <Feather name="check" size={8} color="#FFFFFF" />
                ) : null}
              </View>
              <Text
                style={[
                  styles.timelineLabel,
                  isDone && styles.timelineLabelDone,
                  isCurrent && styles.timelineLabelCurrent,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
