import { setGlobalOptions } from "firebase-functions";

import { lookupAmazonItem } from "./amazonLookup";
import { analyzeGearImageWithRekognition } from "./rekognitionLookup";
import { lookupSerpApiProduct } from "./serpapiLookup";
import { lookupUPCItemDB } from "./upcitemdbLookup";

setGlobalOptions({ maxInstances: 10 });

export {
  analyzeGearImageWithRekognition,
  lookupAmazonItem,
  lookupSerpApiProduct,
  lookupUPCItemDB
};
