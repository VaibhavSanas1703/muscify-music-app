import { Clock, Compass, Globe, Heart, ListMusic, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { LibraryView, Playlist } from "../types/music";

interface SidebarProps {
    activeView: LibraryView;
    activePlaylistId: string | null;
    playlists: Playlist[];
    likedCount: number;
    recentCount: number;
    cachedCount: number;
    isOpenMobile: boolean;
    onCloseMobile: () => void;
    onSelectView: (view: LibraryView) => void;
    onSelectPlaylist: (playlistId: string) => void;
    onCreatePlaylist: () => void;
}

export function Sidebar({
    activeView,
    activePlaylistId,
    playlists,
    likedCount,
    recentCount,
    cachedCount,
    isOpenMobile,
    onCloseMobile,
    onSelectView,
    onSelectPlaylist,
    onCreatePlaylist,
}: SidebarProps) {
    const navItems: {
        id: LibraryView;
        label: string;
        icon: typeof Compass;
        count?: number;
    }[] = [
        { id: "discover", label: "Discover", icon: Compass },
        { id: "search", label: "Online Search", icon: Globe },
        { id: "liked", label: "Liked Songs", icon: Heart, count: likedCount },
        {
            id: "recent",
            label: "Recently Played",
            icon: Clock,
            count: recentCount,
        },
    ];

    const renderNavContent = (scope: "desktop" | "mobile") => (
        <div className="flex flex-col h-full bg-[#0E1116] border-r border-white/[0.08] w-60 select-none">
            {/* Brand Zone: Single text element wordmark */}
            <div className="flex items-center justify-between h-16 px-5 border-b border-white/[0.06] shrink-0">
                <button
                    type="button"
                    onClick={() => {
                        onSelectView("discover");
                        onCloseMobile();
                    }}
                    className="inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] rounded"
                >
                    <span
                        className="w-7 h-7 rounded-lg bg-[#4169E1] text-white flex items-center justify-center shrink-0 shadow-sm"
                        aria-hidden="true"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M4 13v-2m4 5V8m4 9V7m4 7v-4m4 3v-2"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </span>
                    <span>Muscify</span>
                    <p>By Vaibhav Sanas</p>
                </button>
                <button
                    type="button"
                    onClick={onCloseMobile}
                    className="lg:hidden p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/5"
                    aria-label="Close navigation menu"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Primary Library Navigation */}
            <nav
                aria-label="Library navigation"
                className="px-3 py-4 space-y-1"
            >
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                                onSelectView(item.id);
                                onCloseMobile();
                            }}
                            className={`relative w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                                isActive
                                    ? "text-white"
                                    : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
                            }`}
                        >
                            {isActive && (
                                <motion.span
                                    layoutId={`sidebar-active-${scope}`}
                                    transition={{
                                        type: "spring",
                                        stiffness: 460,
                                        damping: 36,
                                    }}
                                    className="absolute inset-0 rounded-lg bg-white/[0.08]"
                                    aria-hidden="true"
                                />
                            )}
                            <span className="relative z-10 flex items-center gap-3 min-w-0">
                                <Icon
                                    size={17}
                                    className={
                                        isActive
                                            ? "text-[#6B8EFF] shrink-0"
                                            : "text-zinc-400 shrink-0"
                                    }
                                />
                                <span className="truncate">{item.label}</span>
                            </span>
                            {typeof item.count === "number" && (
                                <span className="relative z-10 font-mono-tabular text-xs text-zinc-500 shrink-0">
                                    {item.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Playlists Section */}
            <div className="flex-1 flex flex-col min-h-0 px-3 pt-3 border-t border-white/[0.06]">
                <div className="flex items-center justify-between px-3 pb-2">
                    <span className="text-xs font-medium text-zinc-500">
                        Playlists
                    </span>
                    <motion.button
                        whileTap={{ scale: 0.93 }}
                        type="button"
                        onClick={onCreatePlaylist}
                        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-[#6B8EFF] transition-colors whitespace-nowrap shrink-0 py-1 px-1.5 rounded hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1]"
                    >
                        <Plus size={14} />
                        <span>New</span>
                    </motion.button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-0.5 pb-4">
                    {playlists.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-zinc-600">
                            No playlists yet.
                        </p>
                    ) : (
                        playlists.map((pl) => {
                            const isActive =
                                activeView === "playlist" &&
                                activePlaylistId === pl.id;
                            return (
                                <button
                                    key={pl.id}
                                    type="button"
                                    onClick={() => {
                                        onSelectPlaylist(pl.id);
                                        onCloseMobile();
                                    }}
                                    className={`relative w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                                        isActive
                                            ? "text-white font-medium"
                                            : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
                                    }`}
                                >
                                    {isActive && (
                                        <motion.span
                                            layoutId={`sidebar-playlist-active-${scope}`}
                                            transition={{
                                                type: "spring",
                                                stiffness: 460,
                                                damping: 36,
                                            }}
                                            className="absolute inset-0 rounded-lg bg-white/[0.08]"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                                        <ListMusic
                                            size={15}
                                            className={
                                                isActive
                                                    ? "text-[#6B8EFF] shrink-0"
                                                    : "text-zinc-500 shrink-0"
                                            }
                                        />
                                        <span className="truncate">
                                            {pl.name}
                                        </span>
                                    </span>
                                    <span className="relative z-10 font-mono-tabular text-xs text-zinc-600 shrink-0">
                                        {pl.trackIds.length}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Browser Persistence Summary */}
            <div className="p-4 border-t border-white/[0.06] text-xs text-zinc-500 space-y-1 shrink-0">
                <div className="font-medium text-zinc-400">
                    Saved in Browser
                </div>
                <div className="font-mono-tabular text-[11px] text-zinc-500">
                    {likedCount} liked · {cachedCount} saved tracks
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop persistent sidebar */}
            <aside className="hidden lg:block shrink-0 h-full">
                {renderNavContent("desktop")}
            </aside>

            {/* Mobile slide-over sidebar */}
            <AnimatePresence>
                {isOpenMobile && (
                    <div className="fixed inset-0 z-40 lg:hidden flex">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="fixed inset-0 bg-black/65 backdrop-blur-xs"
                            onClick={onCloseMobile}
                            aria-hidden="true"
                        />
                        <motion.aside
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{
                                duration: 0.22,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                            className="relative z-10 h-full shadow-2xl"
                        >
                            {renderNavContent("mobile")}
                        </motion.aside>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
