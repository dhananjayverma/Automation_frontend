import { FormEvent } from "react";

export function TopBar({
  pan,
  onPanChange,
  onCreateRun,
}: {
  pan: string;
  onPanChange: (value: string) => void;
  onCreateRun: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm transition-all duration-200">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-xl font-extrabold text-white shadow-md shadow-orange-200/60 transition-transform duration-300 hover:rotate-6">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                RegisterKaro
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                v1.2.0
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-1">
              ITR Credential Console
            </h1>
          </div>
        </div>

        <form onSubmit={onCreateRun} className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative">
            <input
              value={pan}
              onChange={(event) => onPanChange(event.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              maxLength={10}
              className="h-11 w-full sm:w-56 rounded-xl border border-slate-250 bg-white px-4 text-sm font-semibold tracking-wider text-slate-700 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all placeholder-slate-350"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-350 uppercase pointer-events-none">
              PAN
            </span>
          </div>
          <button className="h-11 w-full sm:w-auto rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-orange-200/50 hover:from-orange-600 hover:to-orange-700 active:scale-97 hover:translate-y-[-0.5px] transition-all duration-200">
            Start Run
          </button>
        </form>
      </div>
    </header>
  );
}
