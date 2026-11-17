export async function functionError(error:any, fallback:string):Promise<Error>{
 try{const body=await error?.context?.json();if(typeof body?.error==='string')return new Error(body.error);}catch{}
 return new Error(fallback);
}
