import React from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import type { ReelRow } from '@/lib/supabase';
import type { BookingCheckoutState } from '@/hooks/useBookingCheckout';
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

  return (
    <View>
      {/* 1. HERO IMAGE WITH ACTIONS */}
      <View style={styles.heroWrap}>
        <Image source={{ uri: heroImage }} style={styles.heroImage} contentFit="cover" />
        {/* Top Navigation Row */}
        <View style={[styles.heroNavRow, { top: Platform.OS === 'ios' ? topInset + 6 : 20 }]}>
          <Pressable onPress={handleClose} style={styles.navCircleBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color="#111111" />
          </Pressable>
          <View style={styles.navRightGroup}>
            <Pressable style={styles.navCircleBtn} hitSlop={10}>
              <Feather name="share" size={18} color="#111111" />
            </Pressable>
            <Pressable style={styles.navCircleBtn} hitSlop={10}>
              <Feather name="heart" size={18} color="#111111" />
            </Pressable>
          </View>
        </View>
        {/* Photo Counter Pill */}
        <View style={styles.photoCountPill}>
          <Text style={styles.photoCountText}>1 / {imageUrls.length}</Text>
        </View>
      </View>

      <View style={styles.detailsBody}>
        {/* 2. TITLE & CAPACITY SPECS */}
        <View style={styles.titleSection}>
          <Text style={styles.listingTitle}>{title}</Text>
          <Text style={styles.unitSubtitle}>
            Entire place in {exp?.location || 'Kenyan Coast'}
          </Text>
          <Text style={styles.capacitySpecs}>
            {maxGuests} guest{maxGuests !== 1 ? 's' : ''} · {bedrooms} bedroom{bedrooms !== 1 ? 's' : ''} · {beds} bed{beds !== 1 ? 's' : ''} · {baths} bath{baths !== 1 ? 's' : ''}
          </Text>
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
                  <MaterialCommunityIcons key={s} name="star" size={11} color="#111111" />
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
          <View style={styles.highlightItem}>
            <Feather name="key" size={20} color="#111111" style={styles.highlightIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.highlightHeading}>Seamless check-in</Text>
              <Text style={styles.highlightSub}>
                Check-in at {checkInTime} · Hosted by verified host {hostName}.
              </Text>
            </View>
          </View>

          <View style={styles.highlightItem}>
            <Feather name="map-pin" size={20} color="#111111" style={styles.highlightIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.highlightHeading}>Prime coastal location</Text>
              <Text style={styles.highlightSub}>Located in {exp?.location || 'Kenyan Coast'}.</Text>
            </View>
          </View>

          <View style={styles.highlightItem}>
            <Feather name="shield" size={20} color="#111111" style={styles.highlightIcon} />
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
                  ? 'Full refund if cancelled 7+ days before check-in.'
                  : 'Review the full policy terms before booking.'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.separator} />

        {/* 5. ABOUT DESCRIPTION */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionHeading}>About this place</Text>
          <Text style={styles.descriptionText}>
            {exp?.description ||
              (reel as any).caption ||
              'Enjoy an authentic stay in the Kenyan coast with modern amenities, comfortable furnishings, and warm hospitality.'}
          </Text>
        </View>

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
                This home is a guest favourite based on ratings, reviews and reliability
              </Text>
            </>
          ) : reviewCount > 0 ? (
            <>
              <View style={styles.bigWreathHeader}>
                <MaterialCommunityIcons name="star" size={28} color="#F26522" />
                <Text style={styles.bigRatingText}>{ratingVal.toFixed(1).replace('.', ',')}</Text>
              </View>
              <Text style={styles.bigGuestFavTitle}>Guest reviews</Text>
              <Text style={styles.bigGuestFavSub}>
                Based on {reviewCount} verified guest review{reviewCount !== 1 ? 's' : ''}
              </Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="star-outline" size={32} color="#9CA3AF" />
              <Text style={styles.bigGuestFavTitle}>No reviews yet</Text>
              <Text style={styles.bigGuestFavSub}>
                Reviews will appear here after guests complete their stay.
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
                      <Text style={styles.reviewerLoc}>Verified stay</Text>
                    </View>
                  </View>

                  <View style={styles.reviewRatingRow}>
                    <View style={styles.starsRow}>
                      {Array.from({ length: Number(rev.rating || 5) }).map((_, s) => (
                        <MaterialCommunityIcons key={s} name="star" size={12} color="#111111" />
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

        {/* 7. WHAT THIS PLACE OFFERS */}
        <View style={styles.amenitiesSection}>
          <Text style={styles.sectionHeading}>What this place offers</Text>
          <View style={styles.amenitiesList}>
            {amenities.map((item, idx) => (
              <View key={idx} style={styles.amenityRow}>
                <Feather
                  name={
                    item.toLowerCase().includes('wifi')
                      ? 'wifi'
                      : item.toLowerCase().includes('park')
                      ? 'truck'
                      : item.toLowerCase().includes('tv')
                      ? 'tv'
                      : item.toLowerCase().includes('kitchen')
                      ? 'coffee'
                      : 'check'
                  }
                  size={18}
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
                {showAllAmenities ? 'Show less' : `Show all ${rawAmenities.length} amenities`}
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
                    <Feather name="check" size={10} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <Text style={styles.hostCardName}>{hostName}</Text>
              {verified ? (
                <View style={styles.superhostBadge}>
                  <MaterialCommunityIcons name="shield-check" size={14} color="#008A05" />
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
              <Feather name="briefcase" size={16} color="#222222" />
              <Text style={styles.hostAttrText}>Work: {hostWork}</Text>
            </View>
            <View style={styles.hostAttrRow}>
              <Feather name="globe" size={16} color="#222222" />
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
            <Feather name="calendar" size={18} color="#222222" style={styles.thingIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.thingItemTitle}>Cancellation policy</Text>
              <Text style={styles.thingItemSub}>
                {cancellationPolicy === 'strict'
                  ? 'Full refund if cancelled at least 7 days before check-in.'
                  : cancellationPolicy === 'moderate'
                  ? 'Full refund if cancelled at least 5 days before check-in.'
                  : 'Free cancellation up to 24 hours before check-in.'}
              </Text>
            </View>
          </View>

          <View style={styles.thingItemRow}>
            <Feather name="clock" size={18} color="#222222" style={styles.thingIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.thingItemTitle}>Check-in & Check-out</Text>
              <Text style={styles.thingItemSub}>
                Check-in after {checkInTime} · Check-out before {checkOutTime}
              </Text>
            </View>
          </View>

          <View style={styles.thingItemRow}>
            <Feather name="users" size={18} color="#222222" style={styles.thingIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.thingItemTitle}>House rules</Text>
              <Text style={styles.thingItemSub}>
                Maximum {maxGuests} guests allowed · Respect quiet hours
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
