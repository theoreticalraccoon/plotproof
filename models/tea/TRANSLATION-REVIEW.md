# Tea / GROW translation review

**Status: NOT REVIEWED BY A NATIVE SPEAKER.**

Every Sinhala and Tamil string below was written by a language model and has
had no human review. They are in the product because an untranslated button is
worse than an imperfect one, not because their quality has been established.
This file exists so a reviewer can work through them, and so nobody mistakes
their presence for their correctness.

Regenerate with `python scripts/translation_review.py`.

## How to review

- **Meaning first.** A row is a failure if the Sinhala or Tamil would lead a
  farmer to do something different from the English, even if it reads well.
- **Rows marked (SAFETY) or (ACTION) are the priority.** Those are the
  disclaimers and the instructions someone acts on in a field.
- **Leave `{slots}` exactly as they are.** `{pct}`, `{disease}`, `{date}` and
  the rest are substituted at runtime; renaming or dropping one puts a hole in
  the sentence.
- **Do not translate the English-fallback strings** in the list at the end
  without reading the policy note there first.


## Mechanical checks

- Interpolation slots: **all match English.**

- Terminology to keep consistent (a reviewer should check these read alike):

  - *leaf wetness* — `weather_wetness`, `risk_driver_leaf_wetness`
  - *disease pressure (not diagnosis)* — `risk_title`, `risk_not_diagnosis`, `risk_lede`
  - *soil sensor* — `tea_src_sensor`, `irrigation_anchor_sensor`
  - *uncertain* — `tea_state_uncertain`, `tea_uncertain_body`, `tea_uncertain_expected`

## Strings to review (126)

| key | English | Sinhala | Tamil | context | native review needed |
| --- | --- | --- | --- | --- | --- |
| `grow_crop` | Crop | බෝගය | பயிர் | Grow page - label, button or body copy | yes |
| `grow_crop_cinnamon` | Cinnamon | කුරුඳු | கருவாப்பட்டை | Profile form - crop option | yes |
| `grow_crop_coconut` | Coconut | පොල් | தென்னை | Profile form - crop option | yes |
| `grow_crop_rubber` | Rubber | රබර් | ரப்பர் | Profile form - crop option | yes |
| `grow_crop_tea` | Tea | තේ | தேயிலை | Profile form - crop option | yes |
| `grow_disease_tea_only` | Watering advice covers {crop}. The disease model is tea-only so far, so no disease pressure is shown for this plot. | ජලය සැපයීමේ උපදෙස් {crop} සඳහා වලංගුයි. රෝග ආකෘතිය තේ සඳහා පමණක් බැවින් මෙම ඉඩමට රෝග පීඩනයක් නොපෙන්වයි. | நீர்ப்பாசன ஆலோசனை {crop} பயிருக்கும் பொருந்தும். நோய் மாதிரி தேயிலைக்கு மட்டுமே என்பதால் இந்த நிலத்துக்கு நோய் அழுத்தம் காட்டப்படவில்லை. | Grow page - label, button or body copy | yes |
| `grow_edit_profile` | Change crop or soil | බෝගය හෝ පස වෙනස් කරන්න | பயிர் அல்லது மண்ணை மாற்று | Grow page - label, button or body copy | yes |
| `grow_irrigated` | Can you water this plot? | මෙම ඉඩමට ජලය දිය හැකිද? | இந்த நிலத்துக்கு நீர் பாய்ச்ச முடியுமா? | Grow page - label, button or body copy | yes |
| `grow_lede` | Weather, watering and disease pressure for one plot — from this plot’s own conditions. | එක් ඉඩමක් සඳහා කාලගුණය, ජලය සැපයීම සහ රෝග පීඩනය — එම ඉඩමේම තත්ත්වයන් අනුව. | ஒரு நிலத்துக்கான வானிலை, நீர்ப்பாசனம், நோய் அழுத்தம் — அந்த நிலத்தின் சொந்த நிலைமைகளிலிருந்து. | Grow page - label, button or body copy | yes |
| `grow_needs_profile` | This plot has no crop and soil details yet. Everything on this page is computed from them. | මෙම ඉඩමට තවම බෝගය සහ පස පිළිබඳ විස්තර නැත. මෙම පිටුවේ සියල්ල ගණනය වන්නේ ඒවා අනුවයි. | இந்த நிலத்துக்கு இன்னும் பயிர், மண் விவரங்கள் இல்லை. இந்தப் பக்கத்தில் உள்ள அனைத்தும் அவற்றிலிருந்தே கணக்கிடப்படுகின்றன. | Grow page - label, button or body copy | yes |
| `grow_needs_profile_cta` | Set crop and soil | බෝගය සහ පස සකසන්න | பயிரையும் மண்ணையும் அமை | Grow page - label, button or body copy | yes |
| `grow_no` | No, rainfed | නැහැ, වැසි ජලය පමණි | இல்லை, மழைநீர் மட்டும் | Grow page - label, button or body copy | yes |
| `grow_no_plots` | No plots yet. Map a plot first and it will appear here. | තවම ඉඩම් නැත. පළමුව ඉඩමක් සිතියම්ගත කළ විට එය මෙහි පෙනේ. | இன்னும் நிலங்கள் இல்லை. முதலில் ஒரு நிலத்தை வரைபடமாக்கினால் அது இங்கு தோன்றும். | Grow page - label, button or body copy | yes |
| `grow_no_plots_cta` | Map a plot | ඉඩමක් සිතියම්ගත කරන්න | நிலத்தை வரைபடமாக்கு | Grow page - label, button or body copy | yes |
| `grow_pick_plot` | Which plot? | කුමන ඉඩමද? | எந்த நிலம்? | Grow page - label, button or body copy | yes |
| `grow_save_profile` | Save and continue | සුරකිමින් ඉදිරියට | சேமித்துத் தொடர் | Grow page - label, button or body copy | yes |
| `grow_setup_lede` | Two answers. They set the water-holding capacity and crop water use behind every number on this page. | පිළිතුරු දෙකයි. මෙම පිටුවේ සෑම අගයකටම පාදක වන්නේ ඒවායි. | இரண்டு பதில்கள். இந்தப் பக்கத்தின் ஒவ்வொரு எண்ணுக்கும் அவையே அடிப்படை. | Grow page - label, button or body copy | yes |
| `grow_setup_title` | Tell us about this plot | මෙම ඉඩම ගැන කියන්න | இந்த நிலத்தைப் பற்றிச் சொல்லுங்கள் | Grow page - label, button or body copy | yes |
| `grow_soil` | Soil type | පස් වර්ගය | மண் வகை | Grow page - label, button or body copy | yes |
| `grow_soil_clay` | Clay | මැටි | களிமண் | Profile form - soil texture option | yes |
| `grow_soil_clay_loam` | Clay loam | මැටි ලෝම් | களி வண்டல் | Profile form - soil texture option | yes |
| `grow_soil_help` | Squeeze damp soil in your hand: it crumbles apart = sandy, it holds a ribbon = clay. | තෙත් පස අතට ගෙන මිරිකන්න: කැඩී බිඳී යයි නම් වැලි, පටියක් සේ රැඳේ නම් මැටි. | ஈரமான மண்ணைக் கையில் பிழியுங்கள்: நொறுங்கினால் மணல், நாடாவாக நீண்டால் களிமண். | Profile form - soil texture option | yes |
| `grow_soil_loam` | Loam | ලෝම් | வண்டல் | Profile form - soil texture option | yes |
| `grow_soil_sand` | Sandy | වැලි | மணல் | Profile form - soil texture option | yes |
| `grow_soil_sandy_loam` | Sandy loam | වැලි ලෝම් | மணல் வண்டல் | Profile form - soil texture option | yes |
| `grow_title` | Grow | වගාව | பயிரிடு | Grow page - label, button or body copy | yes |
| `grow_yes` | Yes | ඔව් | ஆம் | Grow page - label, button or body copy | yes |
| `irrigation_anchor_balance` | Estimated from rainfall and evaporation only — no soil observation was available. | වර්ෂාව හා වාෂ්පීකරණය අනුව පමණක් ඇස්තමේන්තු කර ඇත — පස් නිරීක්ෂණයක් නොතිබුණි. | மழை, ஆவியாதல் மட்டுமே கொண்டு மதிப்பிடப்பட்டது — மண் அவதானிப்பு எதுவும் கிடைக்கவில்லை. | Field status - which evidence set the soil state (HONESTY) | yes |
| `irrigation_anchor_grid` | Set by a satellite-informed soil model for this area. A sensor in the plot would replace this estimate with a measurement. | මෙම ප්‍රදේශය සඳහා චන්ද්‍රිකා දත්ත මත පදනම් වූ පස් ආකෘතියකින්. ඉඩමේ සංවේදකයක් මෙම ඇස්තමේන්තුව මිනුමකින් ප්‍රතිස්ථාපනය කරයි. | இந்தப் பகுதிக்கான செயற்கைக்கோள் சார்ந்த மண் மாதிரியிலிருந்து. நிலத்தில் ஒரு உணரி இந்த மதிப்பீட்டை உண்மையான அளவீடாக மாற்றும். | Field status - which evidence set the soil state (HONESTY) | yes |
| `irrigation_anchor_sensor` | Set by your soil sensor, measured in this plot. | ඔබේ පස් සංවේදකය මෙම ඉඩමේදීම මැන ඇත. | உங்கள் மண் உணரி இந்த நிலத்திலேயே அளந்தது. | Field status - which evidence set the soil state (HONESTY) | yes |
| `irrigation_method` | FAO-56 soil-water balance | FAO-56 පස්-ජල තුලනය | FAO-56 மண்-நீர் சமநிலை | Field status - label or verdict | yes |
| `irrigation_mm` | {mm} mm | මි.මී. {mm} | {mm} மி.மீ. | Field status - label or verdict | yes |
| `irrigation_mm_used` | {mm} mm used | මි.මී. {mm} භාවිත වූ විට | {mm} மி.மீ. பயன்படுத்தியபின் | Field status - label or verdict | yes |
| `irrigation_no_action` | No watering needed | දැන් වතුර දැමිය යුතු නැත | இப்போது நீர் தேவையில்லை | Field status - label or verdict | yes |
| `irrigation_raw_label` | Stress begins at | පීඩනය ඇරඹෙන්නේ | அழுத்தம் தொடங்கும் இடம் | Field status - label or verdict | yes |
| `irrigation_taw_label` | Soil can hold | පසට රඳවා ගත හැක්කේ | மண் தாங்கும் அளவு | Field status - label or verdict | yes |
| `irrigation_title` | Watering | ජල සම්පාදනය | நீர்ப்பாசனம் | Field status - label or verdict | yes |
| `irrigation_water_now` | Water now | දැන් වතුර දමන්න | இப்போது நீர் பாய்ச்சவும் | Field status - label or verdict | yes |
| `irrigation_water_soon` | Water within a day or two | දිනක් දෙකක් ඇතුළත ජලය දෙන්න | ஓரிரு நாட்களுக்குள் நீர் பாய்ச்சுங்கள் | Field status - label or verdict | yes |
| `irrigation_waterlogged` | Too wet — do not water | ඉතා තෙතයි — ජලය නොදෙන්න | மிகவும் ஈரம் — நீர் பாய்ச்ச வேண்டாம் | Field status - label or verdict | yes |
| `risk_band_high` | High | ඉහළ | அதிகம் | Conditions - pressure band | yes |
| `risk_band_low` | Low | අවම | குறைவு | Conditions - pressure band | yes |
| `risk_band_moderate` | Moderate | මධ්‍යම | நடுத்தரம் | Conditions - pressure band | yes |
| `risk_basis` | Basis | පදනම | அடிப்படை | Conditions - label or body copy | yes |
| `risk_caveats_title` | What this cannot tell you | මෙය කියන දේ සහ නොකියන දේ | இது என்ன சொல்கிறது, என்ன சொல்லவில்லை | Conditions - label or body copy | yes |
| `risk_check_leaves` | Check a leaf | කොළ පරීක්ෂා කරන්න | இலைகளைச் சரிபார் | Conditions - label or body copy | yes |
| `risk_days` | {days} of {window} days favourable | දින {window} න් {days} ක් හිතකරයි | {window} நாட்களில் {days} நாட்கள் சாதகம் | Conditions - label or body copy | yes |
| `risk_disease_blister_blight` | Blister blight | බුබුලු අංගමාරය | கொப்புளக் கருகல் | Conditions - disease name | yes |
| `risk_disease_brown_blight` | Brown blight | දුඹුරු අංගමාරය | பழுப்புக் கருகல் | Conditions - disease name | yes |
| `risk_disease_grey_blight` | Grey blight | අළු අංගමාරය | சாம்பல் கருகல் | Conditions - disease name | yes |
| `risk_driver_humidity` | Humidity averaged {rh}% | සාපේක්ෂ ආර්ද්‍රතාව සාමාන්‍යයෙන් {rh}% | ஈரப்பதம் சராசரியாக {rh}% | Conditions - the 'why' behind a pressure score | yes |
| `risk_driver_leaf_wetness` | Leaves stayed wet about {hours} h a day, on {days} of {window} days | දින {window} න් {days} ක, දිනකට පැය {hours} ක් පමණ කොළ තෙත්ව පැවතුණි | {window} நாட்களில் {days} நாட்கள், நாளொன்றுக்கு சுமார் {hours} மணி நேரம் இலைகள் ஈரமாக இருந்தன | Conditions - the 'why' behind a pressure score | yes |
| `risk_driver_sunshine` | Only {hours} h of sunshine a day | දිනකට හිරු එළිය පැය {hours} ක් පමණි | நாளொன்றுக்கு {hours} மணி நேரம் மட்டுமே சூரிய ஒளி | Conditions - the 'why' behind a pressure score | yes |
| `risk_driver_temperature` | Average temperature {temp}°C | සාමාන්‍ය උෂ්ණත්වය {temp}°C | சராசரி வெப்பநிலை {temp}°C | Conditions - the 'why' behind a pressure score | yes |
| `risk_lede` | How far the last two weeks of weather favoured each disease. This is not a diagnosis. | පසුගිය සති දෙකේ කාලගුණය එක් එක් රෝගයට කෙතරම් හිතකර වීද යන්න. මෙය රෝග විනිශ්චයක් නොවේ. | கடந்த இரு வாரங்களின் வானிலை ஒவ்வொரு நோய்க்கும் எவ்வளவு சாதகமாக இருந்தது என்பது. இது நோயறிதல் அல்ல. | Conditions - label or body copy | yes |
| `risk_no_spray_advice` | We do not name a pesticide or a dose. Confirm treatment with your TRI extension officer. | අපි කිසිදු කෘමිනාශකයක් හෝ මාත්‍රාවක් නම් නොකරමු. | நாங்கள் எந்தப் பூச்சிக்கொல்லியையும் அதன் அளவையும் பெயரிடுவதில்லை. | Conditions - pesticide disclaimer (SAFETY) | yes |
| `risk_not_diagnosis` | Weather favouring a disease is not the same as having it. Check your leaves. | මෙය කාලගුණයෙන් ගණනය කළ පීඩනයකි, රෝග විනිශ්චයක් නොවේ. කොළ පරීක්ෂා කරන්න. | இது வானிலையிலிருந்து கணக்கிடப்பட்ட அழுத்தம், நோயறிதல் அல்ல. இலைகளைப் பாருங்கள். | Conditions - pressure is not a diagnosis (SAFETY) | yes |
| `risk_title` | Disease pressure | රෝග අවදානම | நோய் அபாயம் | Conditions - label or body copy | yes |
| `risk_why` | Why | ඇයි | ஏன் | Conditions - label or body copy | yes |
| `tea_action_title` | What to do next | මීළඟට කළ යුත්තේ | அடுத்து என்ன செய்வது | Advisory - what to do next (action a farmer takes) | yes |
| `tea_analyse` | Check this leaf | මෙම කොළය පරීක්ෂා කරන්න | இந்த இலையைச் சரிபார் | Leaf page - label, button or body copy | yes |
| `tea_analysing` | Looking at the leaf… | කොළය බලමින්… | இலையைப் பார்க்கிறது… | Leaf page - label, button or body copy | yes |
| `tea_analysing_note` | The first check downloads the model to this device. Later checks are much faster. | පළමු වර ආකෘතිය මෙම උපාංගයට බාගත වේ. පසුව එය වේගවත් වේ. | முதல் முறை மாதிரி இந்தச் சாதனத்தில் பதிவிறக்கப்படுகிறது. அடுத்த முறைகள் மிக வேகமாக இருக்கும். | Leaf page - label, button or body copy | yes |
| `tea_check_another` | Check another leaf | තවත් කොළයක් පරීක්ෂා කරන්න | இன்னொரு இலையைச் சரிபார் | Leaf page - label, button or body copy | yes |
| `tea_class_blister_blight` | _(from the model card)_ | බුබුලු අංගමාරය | கொப்புளக் கருகல் | Leaf assessment - disease/pest name (English comes from the model card) | yes |
| `tea_class_brown_blight` | _(from the model card)_ | දුඹුරු අංගමාරය | பழுப்புக் கருகல் | Leaf assessment - disease/pest name (English comes from the model card) | yes |
| `tea_class_healthy` | _(from the model card)_ | නිරෝගී | ஆரோக்கியமானது | Leaf assessment - disease/pest name (English comes from the model card) | yes |
| `tea_class_helopeltis` | _(from the model card)_ | තේ මදුරුවා | தேயிலைக் கொசு | Leaf assessment - disease/pest name (English comes from the model card) | yes |
| `tea_class_red_rust` | _(from the model card)_ | රතු මලකඩ | சிவப்புத் துரு | Leaf assessment - disease/pest name (English comes from the model card) | yes |
| `tea_class_red_spider_mite` | _(from the model card)_ | රතු මකුළු මයිටාව | சிவப்புச் சிலந்திப் பூச்சி | Leaf assessment - disease/pest name (English comes from the model card) | yes |
| `tea_confidence` | {pct}% confidence | විශ්වාසය {pct}% | {pct}% நம்பிக்கை | Leaf assessment - confidence figure and its caveat | yes |
| `tea_confidence_caveat` | Confidence is how sure the model is, not the chance it is right. It can be confidently wrong on a farm unlike the ones it learned from. | විශ්වාසය යනු ආකෘතිය කෙතරම් සහතිකද යන්නයි, එය නිවැරදි වීමේ සම්භාවිතාව නොවේ. එය ඉගෙන ගත් ගොවිපළවලට වෙනස් ගොවිපළක විශ්වාසයෙන්ම වැරදි විය හැක. | நம்பிக்கை என்பது மாதிரி எவ்வளவு உறுதியாக உள்ளது என்பதே, அது சரியாக இருக்கும் வாய்ப்பு அல்ல. அது கற்ற பண்ணைகளிலிருந்து வேறுபட்ட பண்ணையில் உறுதியாகவே தவறாகச் சொல்லலாம். | Leaf assessment - confidence figure and its caveat | yes |
| `tea_crop_unsupported` | The leaf checker only covers tea. This plot is set to {crop}, so no leaf diagnosis is offered — a tea model cannot read a {crop} leaf. Watering and weather advice still work. | කොළ පරීක්ෂකය ආවරණය කරන්නේ තේ පමණි. මෙම ඉඩම {crop} ලෙස සකසා ඇති බැවින් කොළ රෝග විනිශ්චයක් ලබා නොදේ. ජලය සැපයීම හා කාලගුණ උපදෙස් තවමත් ක්‍රියා කරයි. | இலைச் சரிபார்ப்பு தேயிலையை மட்டுமே உள்ளடக்கும். இந்த நிலம் {crop} என அமைக்கப்பட்டுள்ளதால் இலை நோயறிதல் வழங்கப்படவில்லை. நீர்ப்பாசன, வானிலை ஆலோசனை தொடர்ந்து செயல்படும். | Leaf assessment - non-tea crop is refused | yes |
| `tea_error_bad_image` | That file could not be read as an image. Try a JPEG or PNG. | එම ගොනුව ඡායාරූපයක් ලෙස කියවිය නොහැකි විය. JPEG හෝ PNG උත්සාහ කරන්න. | அந்தக் கோப்பைப் படமாகப் படிக்க முடியவில்லை. JPEG அல்லது PNG முயற்சிக்கவும். | Leaf assessment - error state | yes |
| `tea_error_inference_failed` | Something went wrong while checking the leaf. | කොළය පරීක්ෂා කිරීමේදී යමක් වැරදී ගියේය. | இலையைச் சரிபார்க்கும்போது ஏதோ தவறு நேர்ந்தது. | Leaf assessment - error state | yes |
| `tea_error_load_failed` | The model could not be downloaded. Check your connection and try again. | ආකෘතිය බාගත කළ නොහැකි විය. සම්බන්ධතාවය පරීක්ෂා කර නැවත උත්සාහ කරන්න. | மாதிரியைப் பதிவிறக்க முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும். | Leaf assessment - error state | yes |
| `tea_error_no_artifact` | The model has not been published to this app yet. | ආකෘතිය තවම මෙම යෙදුමට ප්‍රකාශයට පත් කර නැත. | மாதிரி இன்னும் இந்தப் பயன்பாட்டில் வெளியிடப்படவில்லை. | Leaf assessment - error state | yes |
| `tea_error_still_useful` | Weather and watering advice on this plot are unaffected. | මෙම ඉඩමේ කාලගුණ සහ ජලය සැපයීමේ උපදෙස් වලට මෙයින් බලපෑමක් නැත. | இந்த நிலத்தின் வானிலை, நீர்ப்பாசன ஆலோசனை இதனால் பாதிக்கப்படவில்லை. | Leaf assessment - error state | yes |
| `tea_formats` | JPEG, PNG or WebP, from your camera or gallery. | JPEG, PNG හෝ WebP — කැමරාවෙන් හෝ ගැලරියෙන්. | JPEG, PNG அல்லது WebP — கேமரா அல்லது கேலரியிலிருந்து. | Leaf page - label, button or body copy | yes |
| `tea_guidance_in_english` | Detailed guidance below is written in English. We do not machine-translate instructions a farmer acts on — a mistranslated treatment instruction is worse than an English one. | පහත විස්තරාත්මක උපදෙස් ඉංග්‍රීසියෙන් ලියා ඇත. ගොවියෙකු ක්‍රියාත්මක කරන උපදෙස් යන්ත්‍රයෙන් පරිවර්තනය නොකරමු — වැරදි පරිවර්තනයක් ඉංග්‍රීසියට වඩා නරකයි. | கீழுள்ள விரிவான வழிகாட்டுதல் ஆங்கிலத்தில் உள்ளது. விவசாயி செயல்படுத்தும் அறிவுறுத்தல்களை நாங்கள் இயந்திர மொழிபெயர்ப்பு செய்வதில்லை — தவறான மொழிபெயர்ப்பு ஆங்கிலத்தை விட மோசமானது. | Page header - discloses the English fallback | yes |
| `tea_kind_calculated` | calculated | ගණනය කළ | கணக்கிடப்பட்டது | Advisory - provenance chip beside an evidence line | yes |
| `tea_kind_estimated` | outside estimate | පිටත ඇස්තමේන්තුව | வெளி மதிப்பீடு | Advisory - provenance chip beside an evidence line | yes |
| `tea_kind_inferred` | model inference | ආකෘතියේ අනුමානය | மாதிரியின் ஊகம் | Advisory - provenance chip beside an evidence line | yes |
| `tea_kind_measured` | measured here | මෙහිදී මැනූ | இங்கே அளக்கப்பட்டது | Advisory - provenance chip beside an evidence line | yes |
| `tea_lede` | Photograph one leaf. The result is a suggestion from an image, not a laboratory test. | එක් කොළයක ඡායාරූපයක් ගන්න. ප්‍රතිඵලය ඡායාරූපයකින් ලැබෙන යෝජනාවකි, රසායනාගාර පරීක්ෂණයක් නොවේ. | ஒரு இலையைப் புகைப்படம் எடுங்கள். முடிவு ஒரு படத்திலிருந்து வரும் பரிந்துரை, ஆய்வகச் சோதனை அல்ல. | Leaf page - label, button or body copy | yes |
| `tea_limitations_title` | What this checker cannot do | මෙම පරීක්ෂකයට කළ නොහැක්කේ | இந்தச் சரிபார்ப்பால் செய்ய முடியாதவை | Advisory - model card limitations | yes |
| `tea_model_version` | Model {version} | ආකෘතිය {version} | மாதிரி {version} | Leaf page - label, button or body copy | yes |
| `tea_no_pesticide` | We never name a pesticide or a dose. Confirm any treatment with your TRI extension officer. | අපි කිසිදා කෘමිනාශකයක් හෝ මාත්‍රාවක් නම් නොකරමු. ඕනෑම ප්‍රතිකාරයක් ඔබේ TRI නිලධාරියා සමඟ තහවුරු කරගන්න. | நாங்கள் ஒருபோதும் பூச்சிக்கொல்லியையோ அதன் அளவையோ பெயரிடுவதில்லை. எந்தச் சிகிச்சையையும் உங்கள் TRI அலுவலரிடம் உறுதிப்படுத்துங்கள். | Advisory - pesticide disclaimer (SAFETY) | yes |
| `tea_not_cross_validated` | This condition could not be checked against any independent dataset. Treat it as a lead, not a finding. | මෙම තත්ත්වය ස්වාධීන දත්ත කට්ටලයකට එරෙහිව පරීක්ෂා කළ නොහැකි විය. එය නිගමනයක් නොව ඉඟියක් ලෙස සලකන්න. | இந்த நிலையை எந்தத் தனித்த தரவுத்தொகுப்பிலும் சரிபார்க்க முடியவில்லை. இதை முடிவாக அல்ல, ஒரு தடயமாகக் கருதுங்கள். | Leaf assessment - external-validation warning (SAFETY) | yes |
| `tea_other_possibilities` | Other possibilities | වෙනත් හැකියාවන් | மற்ற சாத்தியங்கள் | Leaf page - label, button or body copy | yes |
| `tea_photo_tips_title` | For a better photo | වඩා හොඳ ඡායාරූපයකට | சிறந்த படத்துக்கு | Leaf page - label, button or body copy | yes |
| `tea_preview_alt` | The leaf photo you selected | ඔබ තෝරාගත් කොළයේ ඡායාරූපය | நீங்கள் தேர்ந்தெடுத்த இலைப் புகைப்படம் | Leaf page - label, button or body copy | yes |
| `tea_preview_note` | The model sees a square centre crop of this photo. | ආකෘතිය දකින්නේ මෙම ඡායාරූපයේ මධ්‍යයේ හතරැස් කොටස පමණි. | மாதிரி இந்தப் படத்தின் நடுவிலுள்ள சதுரப் பகுதியை மட்டுமே பார்க்கிறது. | Leaf page - label, button or body copy | yes |
| `tea_retake` | Choose a different photo | වෙනත් ඡායාරූපයක් | வேறு புகைப்படம் | Leaf page - label, button or body copy | yes |
| `tea_section_conditions` | Conditions | තත්ත්වයන් | நிலைமைகள் | Advisory - section heading | yes |
| `tea_section_field` | Field status | ඉඩමේ තත්ත්වය | நிலத்தின் நிலை | Advisory - section heading | yes |
| `tea_section_leaf` | Leaf assessment | කොළය | இலை | Advisory - section heading | yes |
| `tea_section_why` | Why this advice | මෙම උපදෙසට හේතුව | இந்த ஆலோசனைக்குக் காரணம் | Advisory - section heading | yes |
| `tea_src_environment` | Conditions | තත්ත්ව | நிலைமைகள் | Advisory - source label beside an evidence line | yes |
| `tea_src_image` | Photo | ඡායාරූපය | புகைப்படம் | Advisory - source label beside an evidence line | yes |
| `tea_src_sensor` | Soil sensor | පස් සංවේදකය | மண் உணரி | Advisory - source label beside an evidence line | yes |
| `tea_src_weather` | Weather model | කාලගුණ ආකෘතිය | வானிலை மாதிரி | Advisory - source label beside an evidence line | yes |
| `tea_state_error` | The leaf checker could not run | කොළ පරීක්ෂකය ක්‍රියා නොකළේය | இலைச் சரிபார்ப்பு இயங்கவில்லை | Leaf assessment - outcome heading | yes |
| `tea_state_uncertain` | Uncertain — retake the photo | අවිනිශ්චිතයි — නැවත ඡායාරූපයක් ගන්න | உறுதியற்றது — மீண்டும் படம் எடுக்கவும் | Leaf assessment - outcome heading | yes |
| `tea_take_photo` | Take or choose a photo | ඡායාරූපයක් ගන්න | புகைப்படம் எடுக்கவும் | Leaf page - label, button or body copy | yes |
| `tea_tip_focus` | Keep the leaf in focus and hold still. | කොළය පැහැදිලිව තබාගෙන නිශ්චලව සිටින්න. | இலையைத் தெளிவாக வைத்து அசையாமல் பிடியுங்கள். | Leaf assessment - photo guidance when uncertain | yes |
| `tea_tip_light` | Use good natural light — not direct midday glare, not deep shade. | හොඳ ස්වාභාවික එළියක් භාවිතා කරන්න — දහවල් තද එළිය හෝ ගැඹුරු සෙවණ නොවේ. | நல்ல இயற்கை ஒளியைப் பயன்படுத்துங்கள் — நேரடி நண்பகல் வெயிலோ ஆழ்ந்த நிழலோ அல்ல. | Leaf assessment - photo guidance when uncertain | yes |
| `tea_tip_one_leaf` | Photograph one representative leaf, filling most of the frame. | රාමුවෙන් වැඩි කොටසක් පුරවන සේ නියෝජිත එක් කොළයක් ඡායාරූප ගන්න. | சட்டகத்தின் பெரும்பகுதியை நிரப்பும்படி ஒரு இலையை மட்டும் படம் எடுங்கள். | Leaf assessment - photo guidance when uncertain | yes |
| `tea_tip_retake` | Retake rather than resubmitting the same photo — the result will not change. | එකම ඡායාරූපය නැවත යොමු නොකර අලුතින් ගන්න — ප්‍රතිඵලය වෙනස් නොවේ. | அதே படத்தை மீண்டும் அனுப்பாமல் புதிதாக எடுங்கள் — முடிவு மாறாது. | Leaf assessment - photo guidance when uncertain | yes |
| `tea_tip_shadow` | Avoid hard shadows, reflections and anything covering the leaf. | තද සෙවණැලි, පරාවර්තන සහ කොළය වසන දේ මඟහරින්න. | கடுமையான நிழல்கள், பிரதிபலிப்புகள், இலையை மறைக்கும் எதையும் தவிர்க்கவும். | Leaf assessment - photo guidance when uncertain | yes |
| `tea_title` | Check a leaf | කොළයක් පරීක්ෂා කරන්න | இலையைச் சரிபார்க்கவும் | Leaf page - label, button or body copy | yes |
| `tea_try_again` | Try again | නැවත උත්සාහ කරන්න | மீண்டும் முயற்சிக்கவும் | Leaf page - label, button or body copy | yes |
| `tea_uncertain_body` | The model is not confident enough to name a condition, so it will not guess. A wrong name is worse than no name. | රෝගයක් නම් කිරීමට ආකෘතියට ප්‍රමාණවත් විශ්වාසයක් නැත, එබැවින් එය අනුමාන නොකරයි. වැරදි නමක් නමක් නොමැති වීමට වඩා නරකයි. | ஒரு நிலையைப் பெயரிடும் அளவுக்கு மாதிரிக்கு நம்பிக்கை இல்லை, எனவே அது ஊகிக்காது. தவறான பெயர் பெயரே இல்லாததை விட மோசம். | Leaf assessment - abstention explanation | yes |
| `tea_uncertain_expected` | You will see this often. On photographs from farms unlike the ones it learned from, this model declines to answer about {pct}% of the time. That is it being careful, not a fault in the app. | මෙය නිතර සිදුවේ. එය ඉගෙන ගත් ගොවිපළවලට වෙනස් ගොවිපළක ඡායාරූපවලදී, මෙම ආකෘතිය ආසන්න වශයෙන් {pct}% ක් පිළිතුරු දීම ප්‍රතික්ෂේප කරයි. එය ප්‍රවේශම් වීමකි, යෙදුමේ දෝෂයක් නොවේ. | இது அடிக்கடி நிகழும். அது கற்ற பண்ணைகளிலிருந்து வேறுபட்ட பண்ணைகளின் புகைப்படங்களில், இந்த மாதிரி ஏறக்குறைய {pct}% நேரம் பதில் சொல்ல மறுக்கிறது. இது கவனமாக இருப்பது, செயலியின் கோளாறு அல்ல. | Leaf assessment - abstention explanation | yes |
| `tea_why_lede` | Each line names where it came from, so you can tell a measurement from an estimate. | සෑම පේළියක්ම එය පැමිණි තැන නම් කරයි — මිනුමක් ඇස්තමේන්තුවකින් වෙන් කර හඳුනාගත හැකි වන පරිදි. | ஒவ்வொரு வரியும் அது எங்கிருந்து வந்தது என்பதைக் குறிப்பிடுகிறது — அளவீட்டையும் மதிப்பீட்டையும் வேறுபடுத்த. | Leaf page - label, button or body copy | yes |
| `weather_cached` | Saved weather from {date}. Reconnect to refresh. | {date} දින සුරැකි කාලගුණය. යාවත්කාලීන කිරීමට නැවත සම්බන්ධ වන්න. | {date} அன்று சேமித்த வானிலை. புதுப்பிக்க மீண்டும் இணையுங்கள். | Weather strip / field status - label or failure notice | yes |
| `weather_grid_note` | From a weather model grid cell near your plot, not a station on it. | ඔබේ ඉඩමට ආසන්න කාලගුණ ආකෘති ජාල කොටුවකින් — ඉඩමේම කාලගුණ මධ්‍යස්ථානයකින් නොවේ. | உங்கள் நிலத்துக்கு அருகிலுள்ள வானிலை மாதிரிக் கட்டத்திலிருந்து — நிலத்தில் உள்ள நிலையத்திலிருந்து அல்ல. | Weather strip / field status - label or failure notice | yes |
| `weather_loading` | Loading weather for this plot… | මෙම ඉඩමේ කාලගුණය ලබා ගනිමින්… | இந்த நிலத்தின் வானிலை ஏற்றப்படுகிறது… | Weather strip / field status - label or failure notice | yes |
| `weather_observed_through` | Observed through {date} | {date} දක්වා නිරීක්ෂණය කර ඇත | {date} வரை அவதானிக்கப்பட்டது | Weather strip / field status - label or failure notice | yes |
| `weather_rain_7d` | Rain, last 7 days | වර්ෂාව, දින 7 | மழை, கடந்த 7 நாட்கள் | Weather strip / field status - label or failure notice | yes |
| `weather_retry` | Try again | නැවත උත්සාහ කරන්න | மீண்டும் முயற்சிக்கவும் | Weather strip / field status - label or failure notice | yes |
| `weather_sunshine` | Sunshine | හිරු එළිය | சூரிய ஒளி | Weather strip / field status - label or failure notice | yes |
| `weather_temp_mean` | Average temperature | සාමාන්‍ය උෂ්ණත්වය | சராசரி வெப்பநிலை | Weather strip / field status - label or failure notice | yes |
| `weather_title` | Weather on this plot | කාලගුණය | வானிலை | Weather strip / field status - label or failure notice | yes |
| `weather_unavailable` | Weather is unavailable right now, so nothing below is shown. We do not estimate it in its place. | දැන් කාලගුණ දත්ත නොලැබේ, එබැවින් පහත කිසිවක් නොපෙන්වයි. අපි ඒ වෙනුවට අනුමාන නොකරමු. | இப்போது வானிலைத் தரவு கிடைக்கவில்லை, எனவே கீழே எதுவும் காட்டப்படவில்லை. அதற்குப் பதிலாக நாங்கள் ஊகிப்பதில்லை. | Weather strip / field status - label or failure notice | yes |
| `weather_wetness` | Leaf wetness | කොළ තෙතමනය | இலை ஈரப்பதம் | Weather strip / field status - label or failure notice | yes |

## Deliberately English in every language (27)

These are **not** missing translations. Per D-016 the app does not
machine-translate a sentence a farmer acts on: a mistranslated treatment or
watering instruction is worse than an English one. `tea_guidance_in_english`
tells the reader this, in their own language, at the top of the page, and the
renderer marks these runs `lang="en"` so a screen reader does not pronounce
English with a Sinhala or Tamil voice.

A reviewer may translate these, but only as reviewed prose, never in bulk.

| key | English | context |
| --- | --- | --- |
| `irrigation_apply` | Apply about {mm} mm — roughly {litres} litres across this plot. | Field status - quantity to apply (ACTION) |
| `irrigation_rainfed_note` | You marked this plot rainfed, so read this as a stress warning rather than an instruction. | Field status - label or verdict |
| `irrigation_reason_no_action` | The root zone has used {pct}% of the water it can hold. That is still comfortable. | Field status - why this watering verdict |
| `irrigation_reason_water_now` | The root zone is {depletion} mm short of full, past the {raw} mm at which this crop starts to suffer. | Field status - why this watering verdict |
| `irrigation_reason_water_soon` | The root zone has used {pct}% of its water ({depletion} mm of {taw} mm). Stress starts near {raw} mm. | Field status - why this watering verdict |
| `irrigation_reason_waterlogged` | {rain} mm of rain in three days on an already-full profile. Watch for root disease, not drought. | Field status - why this watering verdict |
| `tea_action_confirm` | Treat this as a lead. Check more leaves across the plot, and confirm {disease} with your TRI extension officer before treating. | Advisory - what to do next (action a farmer takes) |
| `tea_action_conflict` | The photo and the weather disagree. Inspect several leaves yourself and take the question to your extension officer rather than treating for {disease} now. | Advisory - what to do next (action a farmer takes) |
| `tea_action_error` | Try again when you have a connection. Watering and disease-pressure advice still work. | Advisory - what to do next (action a farmer takes) |
| `tea_action_healthy` | Nothing to act on from this leaf. Keep an eye on the plot. | Advisory - what to do next (action a farmer takes) |
| `tea_action_healthy_watch` | This leaf looks fine, but conditions have favoured disease. Check other leaves over the next few days. | Advisory - what to do next (action a farmer takes) |
| `tea_action_retake` | Take another photo following the guidance above. | Advisory - what to do next (action a farmer takes) |
| `tea_ev_env_conflict` | Conditions currently favour {favoured} ({band} pressure) rather than {seen}. We report this disagreement rather than overruling the photo — check the leaf for both. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_env_healthy_but_pressure` | The leaf looks healthy, but conditions have favoured {disease} ({band} pressure). Keep checking over the coming days. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_env_healthy_calm` | Conditions have not strongly favoured any of the diseases we model. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_env_low` | Recent weather did NOT particularly favour {disease} ({band} pressure). That does not rule it out; the photo is the direct evidence. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_env_no_model` | We have no weather model for {disease}, so conditions say nothing either way. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_env_no_model_pest` | {disease} is a pest, not a fungal disease. We have no weather model for it, so conditions say nothing either way. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_env_standalone` | Conditions favoured {disease}: {band} pressure, {days} of {window} days favourable. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_env_supports` | Recent weather also favoured {disease}: {band} pressure, {days} of {window} days favourable. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_image_confident` | The photo looks like {disease} ({pct}% confidence). | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_image_unavailable` | No photo result — the leaf checker did not run. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_image_uncertain` | The photo was not clear enough to name a condition. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_soil_balance` | Soil water is estimated from rainfall and evaporation only. Watering advice: {verdict}. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_soil_measured` | Your soil sensor measured the root zone directly. Watering advice: {verdict}. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_soil_modelled` | Soil water is a satellite-informed model estimate, not a measurement. Watering advice: {verdict}. | Advisory - one evidence line under 'Why this advice' |
| `tea_ev_weather_provenance` | Weather is from a model grid near your plot, observed through {date} — not a station on your farm. | Advisory - one evidence line under 'Why this advice' |
