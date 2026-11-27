export function SupplierIcon({id,name}:Readonly<{id:string;name:string}>){
 const initials=id==='jorjee'?'JG':id==='ggxg'?'GG':Array.from(name.trim()).slice(0,2).join('').toLocaleUpperCase();
 return <span className="supplier-icon" data-supplier={id} aria-hidden="true">{initials}</span>;
}
