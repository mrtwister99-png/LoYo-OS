import React from 'react';
export class ErrorBoundary extends React.Component<{children: React.ReactNode},{hasError:boolean,error?:Error}> {
  constructor(p:any){ super(p); this.state={hasError:false}; }
  static getDerivedStateFromError(e:Error){ return {hasError:true,error:e}; }
  render(){
    if(this.state.hasError) return <div className="p-8"><h2 className="text-red-400">Chyba v {this.state.error?.message}</h2><button className="mt-4 px-4 py-2 bg-zinc-800 rounded" onClick={()=>location.reload()}>Retry</button></div>;
    return this.props.children;
  }
}