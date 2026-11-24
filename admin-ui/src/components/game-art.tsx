import {Gamepad2} from 'lucide-react';
import freeFire from '../catalog-free-fire.png';
import rov from '../stitch-rov.jpg';
import genshin from '../stitch-genshin.jpg';
import mobileLegends from '../catalog-mobile-legends.png';
import pubg from '../catalog-pubg.png';

const artwork:Record<string,string>={'free-fire':freeFire,rov,genshin,'genshin-impact':genshin,'mobile-legends-bang-bang':mobileLegends,'pubg-mobile':pubg};
const supplierArtwork=import.meta.glob<string>('../supplier-game-icons/*.png',{eager:true,import:'default',query:'?url'});

export function GameMark({gameId,large=false}:{gameId?:string;large?:boolean}){
 const image=gameId?artwork[gameId]??supplierArtwork['../supplier-game-icons/'+gameId+'.png']:undefined;
 return <span className={'game-mark'+(large?' stitch-game-art':'')} aria-hidden="true">
  {image?<img src={image} alt="" loading="lazy" width={48} height={48}/>:<Gamepad2 size={21} strokeWidth={1.8}/>}
 </span>;
}
