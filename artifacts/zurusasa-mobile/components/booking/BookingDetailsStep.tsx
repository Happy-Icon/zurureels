import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import type { ReelRow, SpecialOfferRow } from '@/lib/supabase';
import type { BookingCheckoutState } from '@/hooks/useBookingCheckout';
import { formatExpiryCountdown } from '@/constants/taxonomy';
import { OfferDetailSheet } from '@/components/modals/OfferDetailSheet';
import { ListingLocationMapCard } from '@/components/map/ListingLocationMapCard';
import { bookingStyles as styles } from './bookingStyles';

interface BookingDetailsStepProps {
  reel: ReelRow;
  topInset: number;
  checkout: BookingCheckoutState;
}

export function BookingDetailsStep({ reel, topInset, checkout }: BookingDetailsStepProps) {
  const {
    exp,
    primaryCategory,
    primaryCategoryMeta,
    subcategoryLabel,
    durationInfo,
    operatingHours,
    whatsIncluded,
    meetingPoint,
    activeOffers,
    title,
    heroImage,
    imageUrls,
    maxGuests,
    bedrooms,
    beds,
    baths,
    reviewCount,
    ratingVal,
    reviewsList,
    checkInTime,
    checkOutTime,
    hostName,
    verified,
    hostAvatar,
    hostTenure,
    hostWork,
    hostLanguages,
    hostBio,
    hostResponseRate,
    hostResponseTime,
    cancellationPolicy,
    amenities,
    rawAmenities,
    showAllAmenities,
    setShowAllAmenities,
    handleClose,
    handleSeeAllReviews,
  } = checkout;

  const [selectedOffer, setSelectedOffer] = useState<SpecialOfferRow | null>(null);
  const isAccommodation = primaryCategory === 'accommodation';

  const getAmenityIcon = (label: string): React.ComponentProps<typeof Ionicons>['name'] => {
    const lower = label.toLowerCase();
    if (lower.includes('wifi') || lower.includes('wi-fi')) return 'wifi-outline';
    if (lower.includes('park')) return 'car-outline';
    if (lower.includes('tv') || lower.includes('stream')) return 'tv-outline';
    if (lower.includes('kitchen') || lower.includes('breakfast') || lower.includes('dining')) {
      return 'restaurant-outline';
    }
    if (lower.includes('cocktail') || lower.includes('bar') || lower.includes('drinks')) {
      return 'wine-outline';
    }
    if (lower.includes('sunset')) return 'sunny-outline';
    if (lower.includes('music') || lower.includes('dj')) return 'musical-notes-outline';
    if (lower.includes('guide')) return 'compass-outline';
    return 'checkmark-outline';
  };

  return (
    <View>
      {/* 1. HERO IMAGE WITH ACTIONS */}
      <View style={styles.heroWrap}>
        <Image source={{ uri: heroImage }} style={styles.heroImage} contentFit="cover" />
        {/* Top Navigation Row */}
        <View style={[styles.heroNavRow, { top: Platform.OS === 'ios' ? topInset + 6 : 20 }]}>
          <Pressable onPress={handleClose} style={styles.navCircleBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#111111" />
          </Pressable>
          <View style={styles.navRightGroup}>
            <Pressable style={styles.navCircleBtn} hitSlop={10}>
              <Ionicons name="share-outline" size={19} color="#111111" />
            </Pressable>
            <Pressable style={styles.navCircleBtn} hitSlop={10}>
              <Ionicons name="heart-outline" size={19} color="#111111" />
            </Pressable>
          </View>
        </View>
        {/* Photo Counter Pill */}
        <View style={styles.photoCountPill}>
          <Text style={styles.photoCountText}>1 / {imageUrls.length}</Text>
        </View>
      </View>

      <View style={styles.detailsBody}>
        {/* 2. TITLE & CAPACITY / EXPERIENCE SPECS */}
        <View style={styles.titleSection}>
          <Text style={styles.listingTitle}>{title}</Text>
          <Text style={styles.unitSubtitle}>
            {isAccommodation
              ? `Entire place in ${exp?.location || 'Kenyan Coast'}`
              : `${subcategoryLabel || primaryCategoryMeta.label} in ${exp?.location || 'Kenyan Coast'}`}
          </Text>
          {isAccommodation ? (
            <Text style={styles.capacitySpecs}>
              {maxGuests} guest{maxGuests !== 1 ? 's' : ''} · {bedrooms} bedroom{bedrooms !== 1 ? 's' : ''} · {beds} bed{beds !== 1 ? 's' : ''} · {baths} bath{baths !== 1 ? 's' : ''}
            </Text>
          ) : (
            <Text style={styles.capacitySpecs}>
              Up to {maxGuests} guest{maxGuests !== 1 ? 's' : ''}
              {durationInfo ? ` · ${durationInfo}` : ''}
              {operatingHours ? ` · ${operatingHours}` : ''}
            </Text>
          )}
        </View>

        {/* 3. GUEST FAVOURITE & RATING RIBBON */}
        <View style={styles.guestFavRibbon}>
          <View style={styles.ribbonCol}>
            <Text style={styles.ribbonRatingNumber}>
              {reviewCount > 0 ? ratingVal.toFixed(1).replace('.', ',') : '★ New'}
            </Text>
            {reviewCount > 0 ? (
              <View style={styles.starsRow}>
                {Array.from({ length: Math.min(5, Math.round(ratingVal)) }).map((_, s) => (
                  <Ionicons key={s} name="star" size={11} color="#111111" />
                ))}
              </View>
            ) : (
              <Text style={styles.ribbonReviewsLabel}>New listing</Text>
            )}
          </View>

          <View style={styles.ribbonDivider} />

          <View style={styles.ribbonMiddleCol}>
            {reviewCount >= 3 && ratingVal >= 4.7 ? (
              <View style={styles.laurelRow}>
                <MaterialCommunityIcons name="leaf" size={16} color="#111111" style={{ transform: [{ scaleX: -1 }] }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.guestFavTitle}>Guest</Text>
                  <Text style={styles.guestFavTitle}>favourite</Text>
                </View>
                <MaterialCommunityIcons name="leaf" size={16} color="#111111" />
              </View>
            ) : reviewCount > 0 ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.guestFavTitle}>Verified</Text>
                <Text style={styles.ribbonReviewsLabel}>Guest Rating</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.guestFavTitle}>Be the first</Text>
                <Text style={styles.ribbonReviewsLabel}>to review</Text>
              </View>
            )}
          </View>

          <View style={styles.ribbonDivider} />

          <Pressable onPress={handleSeeAllReviews} style={styles.ribbonCol}>
            <Text style={styles.ribbonReviewsNumber}>{reviewCount}</Text>
            <Text style={styles.ribbonReviewsLabel}>{reviewCount === 1 ? 'Review' : 'Reviews'}</Text>
          </Pressable>
        </View>

        <View style={styles.separator} />

        {/* 4. KEY FEATURE HIGHLIGHTS */}
        <View style={styles.highlightsBlock}>
          {isAccommodation ? (
            <View style={styles.highlightItem}>
              <Ionicons name="key-outline" size={21} color="#111111" style={styles.highlightIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.highlightHeading}>Seamless check-in</Text>
                <Text style={styles.highlightSub}>
                  Check-in at {checkInTime} · Hosted by verified host {hostName}.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.highlightItem}>
              <Ionicons name="time-outline" size={21} color="#111111" style={styles.highlightIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.highlightHeading}>
                  {durationInfo ? `${durationInfo} experience` : 'Schedule & Inclusions'}
                </Text>
                <Text style={styles.highlightSub}>
                  {operatingHours ? `${operatingHours}` : 'Flexible availability'}
                  {whatsIncluded ? ` · Includes ${whatsIncluded}` : ` · Hosted by ${hostName}`}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.highlightItem}>
            <Ionicons name="location-outline" size={21} color="#111111" style={styles.highlightIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.highlightHeading}>
                {!isAccommodation && meetingPoint ? 'Meeting point' : 'Prime coastal location'}
              </Text>
              <Text style={styles.highlightSub}>
                {!isAccommodation && meetingPoint
                  ? `${meetingPoint} (${exp?.location || 'Kenyan Coast'})`
                  : `Located in ${exp?.location || 'Kenyan Coast'}.`}
              </Text>
            </View>
          </View>

          <View style={styles.highlightItem}>
            <Ionicons name="shield-checkmark-outline" size={21} color="#111111" style={styles.highlightIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.highlightHeading}>
                {cancellationPolicy === 'strict'
                  ? 'Strict cancellation policy'
                  : cancellationPolicy === 'moderate'
                  ? 'Moderate cancellation policy'
                  : 'Free cancellation before check-in'}
              </Text>
              <Text style={styles.highlightSub}>
                {cancellationPolicy === 'strict'
                  ? 'Full refund if cancelled 7+ days before booking.'
                  : 'Review the full policy terms before booking.'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.separator} />

        {/* 5. ABOUT DESCRIPTION */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionHeading}>
            {isAccommodation ? 'About this place' : 'About this experience'}
          </Text>
          <Text style={styles.descriptionText}>
            {exp?.description ||
              (reel as any).caption ||
              'Enjoy an authentic experience on the Kenyan coast with warm local hospitality.'}
          </Text>
        </View>

        {/* 5b. ACTIVE SPECIAL OFFERS AT THIS ESTABLISHMENT */}
        {activeOffers.length > 0 ? (
          <>
            <View style={styles.separator} />
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionHeading}>Special Offers Available</Text>
              {activeOffers.map((off) => (
                <Pressable
                  key={off.id}
                  onPress={() => setSelectedOffer(off)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 13,
                    borderRadius: 14,
                    backgroundColor: '#F5F3FF',
                    borderWidth: 1,
                    borderColor: '#DDD6FE',
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      backgroundColor: '#7C3AED',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="pricetag-outline" size={18} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 13.5, fontFamily: 'DMSans_700Bold', color: '#4C1D95' }} numberOfLines={1}>
                      {off.discount_label} · {off.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="alarm-outline" size={12} color="#6D28D9" />
                      <Text style={{ fontSize: 11.5, fontFamily: 'DMSans_500Medium', color: '#6D28D9' }}>
                        {formatExpiryCountdown(off.expires_at)}
                        {off.applicable_schedule ? ` · ${off.applicable_schedule}` : ''}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#6D28D9" />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.separator} />

        {/* 6. REVIEWS SHOWCASE CAROUSEL */}
        <View style={styles.reviewsShowcaseBlock}>
          {reviewCount >= 3 && ratingVal >= 4.7 ? (
            <>
              <View style={styles.bigWreathHeader}>
                <MaterialCommunityIcons name="leaf" size={28} color="#333333" style={{ transform: [{ scaleX: -1 }] }} />
                <Text style={styles.bigRatingText}>{ratingVal.toFixed(1).replace('.', ',')}</Text>
                <MaterialCommunityIcons name="leaf" size={28} color="#333333" />
              </View>
              <Text style={styles.bigGuestFavTitle}>Guest favourite</Text>
              <Text style={styles.bigGuestFavSub}>
                This listing is a guest favourite based on ratings, reviews and reliability
              </Text>
            </>
          ) : reviewCount > 0 ? (
            <>
              <View style={styles.bigWreathHeader}>
                <Ionicons name="star" size={26} color="#F26522" />
                <Text style={styles.bigRatingText}>{ratingVal.toFixed(1).replace('.', ',')}</Text>
              </View>
              <Text style={styles.bigGuestFavTitle}>Guest reviews</Text>
              <Text style={styles.bigGuestFavSub}>
                Based on {reviewCount} verified guest review{reviewCount !== 1 ? 's' : ''}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="star-outline" size={30} color="#9CA3AF" />
              <Text style={styles.bigGuestFavTitle}>No reviews yet</Text>
              <Text style={styles.bigGuestFavSub}>
                Reviews will appear here after guests complete their experience.
              </Text>
            </>
          )}

          {reviewsList.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reviewsCarousel}
            >
              {reviewsList.map((rev) => (
                <View key={rev.id} style={styles.reviewSnippetCard}>
                  <View style={styles.reviewerTopRow}>
                    <View style={styles.reviewerAvatar}>
                      <Text style={styles.reviewerAvatarInitial}>
                        {(rev.reviewer?.full_name || 'G').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.reviewerName}>{rev.reviewer?.full_name || 'Verified Guest'}</Text>
                      <Text style={styles.reviewerLoc}>Verified guest</Text>
                    </View>
                  </View>

                  <View style={styles.reviewRatingRow}>
                    <View style={styles.starsRow}>
                      {Array.from({ length: Number(rev.rating || 5) }).map((_, s) => (
                        <Ionicons key={s} name="star" size={12} color="#111111" />
                      ))}
                    </View>
                    <Text style={styles.reviewTimeAgo}>
                      · {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : 'Recent'}
                    </Text>
                  </View>

                  <Text style={styles.reviewHeadline}>{rev.title || 'Wonderful Experience'}</Text>
                  <Text style={styles.reviewSnippetBody} numberOfLines={3}>
                    {rev.comment}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          {reviewCount > 0 ? (
            <Pressable onPress={handleSeeAllReviews} style={styles.showAllReviewsBtn}>
              <Text style={styles.showAllReviewsBtnText}>Show all {reviewCount} reviews</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.separator} />

        {/* 7. WHAT THIS PLACE / EXPERIENCE OFFERS */}
        <View style={styles.amenitiesSection}>
          <Text style={styles.sectionHeading}>
            {isAccommodation ? 'What this place offers' : "What's included & highlights"}
          </Text>
          <View style={styles.amenitiesList}>
            {amenities.map((item, idx) => (
              <View key={idx} style={styles.amenityRow}>
                <Ionicons
                  name={getAmenityIcon(item)}
                  size={19}
                  color="#222222"
                  style={styles.amenityIcon}
                />
                <Text style={styles.amenityName}>{item}</Text>
              </View>
            ))}
          </View>

          {rawAmenities.length > 6 ? (
            <Pressable
              onPress={() => setShowAllAmenities(!showAllAmenities)}
              style={styles.showAllAmenitiesBtn}
            >
              <Text style={styles.showAllAmenitiesBtnText}>
                {showAllAmenities ? 'Show less' : `Show all ${rawAmenities.length} highlights`}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.separator} />

        {/* 8. WHERE YOU'LL BE */}
        <View style={styles.locationSection}>
          <Text style={styles.sectionHeading}>Where you’ll be</Text>
          <ListingLocationMapCard
            experience={exp}
            reelCoords={{ lat: reel.lat, lng: reel.lng }}
            themeOverride="light"
          />
        </View>

        <View style={styles.separator} />

        {/* 9. MEET YOUR HOST */}
        <View style={styles.meetHostSection}>
          <Text style={styles.sectionHeading}>Meet your host</Text>

          <View style={styles.hostProfileCard}>
            <View style={styles.hostCardLeft}>
              <View style={styles.hostCardAvatarWrap}>
                {hostAvatar ? (
                  <Image source={{ uri: hostAvatar }} style={styles.hostCardAvatar} />
                ) : (
                  <View style={styles.hostCardAvatarFallback}>
                    <Text style={styles.hostCardAvatarInitial}>{hostName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                {verified ? (
                  <View style={styles.hostCardShieldBadge}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <Text style={styles.hostCardName}>{hostName}</Text>
              {verified ? (
                <View style={styles.superhostBadge}>
                  <Ionicons name="shield-checkmark" size={14} color="#008A05" />
                  <Text style={[styles.superhostText, { color: '#008A05' }]}>Verified Host</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.hostCardStatsCol}>
              <View style={styles.hostStatItem}>
                <Text style={styles.hostStatNum}>{reviewCount}</Text>
                <Text style={styles.hostStatLabel}>Reviews</Text>
              </View>
              <View style={styles.hostStatDivider} />
              <View style={styles.hostStatItem}>
                <Text style={styles.hostStatNum}>{ratingVal.toFixed(1)}</Text>
                <Text style={styles.hostStatLabel}>Rating</Text>
              </View>
              <View style={styles.hostStatDivider} />
              <View style={styles.hostStatItem}>
                <Text style={styles.hostStatNum}>{hostTenure.num}</Text>
                <Text style={styles.hostStatLabel}>{hostTenure.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.hostAttributesList}>
            <View style={styles.hostAttrRow}>
              <Ionicons name="briefcase-outline" size={17} color="#222222" />
              <Text style={styles.hostAttrText}>Work: {hostWork}</Text>
            </View>
            <View style={styles.hostAttrRow}>
              <Ionicons name="globe-outline" size={17} color="#222222" />
              <Text style={styles.hostAttrText}>Speaks: {hostLanguages}</Text>
            </View>
          </View>

          <Text style={styles.hostBioText}>{hostBio}</Text>

          <View style={styles.hostDetailsBox}>
            <Text style={styles.hostDetailsTitle}>Host details</Text>
            <Text style={styles.hostDetailsText}>Response rate: {hostResponseRate}</Text>
            <Text style={styles.hostDetailsText}>Responds: {hostResponseTime}</Text>
          </View>
        </View>

        <View style={styles.separator} />

        {/* 10. THINGS TO KNOW */}
        <View style={styles.thingsToKnowSection}>
          <Text style={styles.sectionHeading}>Things to know</Text>

          <View style={styles.thingItemRow}>
            <Ionicons name="calendar-outline" size={19} color="#222222" style={styles.thingIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.thingItemTitle}>Cancellation policy</Text>
              <Text style={styles.thingItemSub}>
                {cancellationPolicy === 'strict'
                  ? 'Full refund if cancelled at least 7 days before start.'
                  : cancellationPolicy === 'moderate'
                  ? 'Full refund if cancelled at least 5 days before start.'
                  : 'Free cancellation up to 24 hours before start.'}
              </Text>
            </View>
          </View>

          {isAccommodation ? (
            <View style={styles.thingItemRow}>
              <Ionicons name="time-outline" size={19} color="#222222" style={styles.thingIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.thingItemTitle}>Check-in & Check-out</Text>
                <Text style={styles.thingItemSub}>
                  Check-in after {checkInTime} · Check-out before {checkOutTime}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.thingItemRow}>
              <Ionicons name="time-outline" size={19} color="#222222" style={styles.thingIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.thingItemTitle}>Timing & Meeting Point</Text>
                <Text style={styles.thingItemSub}>
                  {operatingHours ? `Hours: ${operatingHours}` : 'Schedule confirmed upon booking'}
                  {meetingPoint ? ` · Meet at ${meetingPoint}` : ''}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.thingItemRow}>
            <Ionicons name="people-outline" size={19} color="#222222" style={styles.thingIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.thingItemTitle}>
                {isAccommodation ? 'House rules' : 'Group size & participation'}
              </Text>
              <Text style={styles.thingItemSub}>
                {isAccommodation
                  ? `Maximum ${maxGuests} guests allowed · Respect quiet hours`
                  : `Up to ${maxGuests} participants per booking`}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {selectedOffer ? (
        <OfferDetailSheet
          visible={Boolean(selectedOffer)}
          offer={selectedOffer}
          reel={reel}
          onClose={() => setSelectedOffer(null)}
          onClaimOffer={() => setSelectedOffer(null)}
        />
      ) : null}
    </View>
  );
}
