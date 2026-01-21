import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

const COMMON_LANGUAGES = [
    "English",
    "Swahili",
    "Amharic",
    "French",
    "German",
    "Spanish",
    "Chinese",
    "Arabic",
];

interface LanguageSelectorProps {
    selectedLanguages: string[];
    onChange: (languages: string[]) => void;
}

export const LanguageSelector = ({
    selectedLanguages,
    onChange,
}: LanguageSelectorProps) => {
    const [open, setOpen] = useState(false);

    const addLanguage = (lang: string) => {
        if (!selectedLanguages.includes(lang)) {
            onChange([...selectedLanguages, lang]);
        }
        setOpen(false);
    };

    const removeLanguage = (lang: string) => {
        onChange(selectedLanguages.filter((l) => l !== lang));
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {selectedLanguages.map((lang) => (
                    <Badge key={lang} variant="secondary" className="px-3 py-1 gap-1 text-sm bg-primary/10 hover:bg-primary/20 text-primary">
                        {lang}
                        <button
                            onClick={() => removeLanguage(lang)}
                            className="text-primary hover:text-primary/70 focus:outline-none"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 border-dashed gap-1"
                        >
                            <Plus className="h-3 w-3" />
                            Add Language
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Select language..." />
                            <CommandList>
                                <CommandEmpty>No language found.</CommandEmpty>
                                <CommandGroup>
                                    {COMMON_LANGUAGES.map((lang) => (
                                        <CommandItem
                                            key={lang}
                                            onSelect={() => addLanguage(lang)}
                                            disabled={selectedLanguages.includes(lang)}
                                        >
                                            {lang}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
};
