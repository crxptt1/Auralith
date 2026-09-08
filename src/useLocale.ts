import {useSyncExternalStore} from 'react';
import {getLocale,subscribeLocale} from './i18n.js';
export const useLocale=()=>useSyncExternalStore(subscribeLocale,getLocale,()=> 'en' as const);
