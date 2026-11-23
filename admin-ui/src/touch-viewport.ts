/** Fixed-scale touch gestures for the owner's Mini App, without cancelling single-finger scrolling. */
export function lockTouchZoom(target:Document=document){
 const preventPinch=(event:TouchEvent)=>{if(event.touches.length>1&&event.cancelable)event.preventDefault();};
 const preventSafariGesture=(event:Event)=>{if(event.cancelable)event.preventDefault();};
 const options={passive:false};
 target.addEventListener('touchstart',preventPinch,options);
 target.addEventListener('touchmove',preventPinch,options);
 for(const name of ['gesturestart','gesturechange','gestureend'])target.addEventListener(name,preventSafariGesture,options);
 return()=>{target.removeEventListener('touchstart',preventPinch);target.removeEventListener('touchmove',preventPinch);for(const name of ['gesturestart','gesturechange','gestureend'])target.removeEventListener(name,preventSafariGesture);};
}
