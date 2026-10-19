/**
 * PNY01 exact full name + NAP. Name = the store's full name as used on its Google Business Profile.
 * Public GBP primary phone only. Map link = this store's own Google place ID.
 */
export const FULL_NAME_NAP = {
  "code": "PNY01",
  "fullName": "P60 Cannabis Dispensary Weed Delivery",
  "street": "1938 Weston Rd",
  "city": "York",
  "region": "ON",
  "postal": "M9N 1W2",
  "phoneDisplay": "(289) 217-2763",
  "phoneTel": "tel:+12892172763",
  "hours": "Open 24 hours, 7 days a week",
  "mapsUrl": "https://www.google.com/maps/place/?q=place_id:ChIJZ_nYyQIxK4gRKOTKHwfk5bQ",
  "placeId": "ChIJZ_nYyQIxK4gRKOTKHwfk5bQ",
  "neighbourhood": "Weston Road / York",
  "intersection": "",
  "transit": "Accessible by local TTC bus and transit routes serving Weston Road.",
  "visitPath": "/visit"
} as const;

export const FULL_NAME_NAP_ADDRESS = `${FULL_NAME_NAP.street}, ${FULL_NAME_NAP.city}, ${FULL_NAME_NAP.region} ${FULL_NAME_NAP.postal}`;
