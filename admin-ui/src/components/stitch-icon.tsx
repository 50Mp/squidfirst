interface StitchIconProps {
 readonly name:string;
 readonly size?:number;
 readonly className?:string;
 readonly label?:string;
}

export function StitchIcon({name,size=22,className,label}:StitchIconProps){
 return <span className={className?'stitch-symbol '+className:'stitch-symbol'}
  data-symbol={name} data-size={size} role={label?'img':undefined} aria-label={label}
  aria-hidden={label?undefined:true}/>;
}
