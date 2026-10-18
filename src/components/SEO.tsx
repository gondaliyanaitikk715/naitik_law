import { useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
export default function SEO({title,description}:{title:string;description?:string}) {
 const {settings}=useSettings();
 useEffect(()=>{document.title=title.includes('Naitik Law')?title:`${title} | Naitik Law`;const desc=description||settings.default_seo_description||'Learn Indian law in simple language with Naitik Law. Explore BNS 2023, BNSS, BSA, Constitution of India, Bare Acts, landmark judgments, law notes and legal awareness videos.';for(const [key,value] of [['description',desc],['og:title',document.title],['og:description',desc],['og:url',window.location.href],['og:type','website']]){let el=document.head.querySelector(`meta[${key.startsWith('og:')?'property':'name'}="${key}"]`);if(!el){el=document.createElement('meta');el.setAttribute(key.startsWith('og:')?'property':'name',key);document.head.append(el)}el.setAttribute('content',value)}let canonical=document.head.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.setAttribute('rel','canonical');document.head.append(canonical)}canonical.setAttribute('href',window.location.origin+window.location.pathname);},[title,description,settings.default_seo_description]);
 return null;
}
