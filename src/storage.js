// 本机 IndexedDB 持久化；替换台账与方案分别存储，失败时不覆盖当前内存数据。
export async function storage(key, value) {
  const db=await new Promise((resolve,reject)=>{
    const r=indexedDB.open('dsh-snow-trip',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('data');
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction('data',value===undefined?'readonly':'readwrite');
      const req=value===undefined?tx.objectStore('data').get(key):tx.objectStore('data').put(value,key);
      let result;
      req.onsuccess=()=>{result=req.result;};
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  } finally {db.close();}
}
