import {getLocale} from '../i18n';
import {highFrequencyProfile,type Variant} from '../model';

export function HighFrequencyNote({variant}:{variant:Variant}){
 const profile=highFrequencyProfile(variant);if(!profile)return null;
 const pl=getLocale()==='pl';
 return <p className="deep-mask-note high-frequency-note" role="status">
  <strong>{profile.carrierHz===25000?'Ultrasonic 25 kHz · 96 kHz':'Near-ultrasonic 20 kHz · 48 kHz'}</strong>{' — '}
  {pl?`Afirmacje przeniesione w pasmo ${profile.lowHz/1000}–${profile.highHz/1000} kHz, nie sam ton. `:`Speech shifted into ${profile.lowHz/1000}–${profile.highHz/1000} kHz, not just a tone. `}
  {profile.carrierHz===25000?(pl?'Wymagane wyjście 96 kHz i słuchawki lub głośnik obsługujący to pasmo. System i odsłuch w aplikacji mogą resamplować plik; dla wyjścia 48 kHz wybierz Near-ultrasonic. ':'Requires a 96 kHz output and headphones or speakers supporting this band. The OS and app playback may resample the file; for 48 kHz outputs choose Near-ultrasonic. '):(pl?'Opcja dla wyjścia 48 kHz. Część osób może ją słyszeć; pasmo sprzętu nie jest gwarantowane. ':'An option for 48 kHz outputs. Some people can hear it; hardware bandwidth is not guaranteed. ')}
  {pl?'WAV/FLAC 24-bit. Głosy maks. −24 dBFS; bez podbijania do LUFS. Nie zwiększaj głośności, gdy nic nie słychać. To obróbka sygnału, nie potwierdzenie skuteczności.':'WAV/FLAC 24-bit. Voice ceiling −24 dBFS; no LUFS boosting. Do not raise volume to hear it. Signal processing does not establish effectiveness.'}
 </p>;
}
