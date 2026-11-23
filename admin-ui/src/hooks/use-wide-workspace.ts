import {useEffect,useState} from 'react';
export function useWideWorkspace(){
 const [wide,setWide]=useState(()=>matchMedia('(min-width:1200px)').matches);
 useEffect(()=>{const media=matchMedia('(min-width:1200px)'),update=()=>setWide(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 return wide;
}
