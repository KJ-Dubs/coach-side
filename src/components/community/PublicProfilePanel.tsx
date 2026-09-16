import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BubbleButton, Field, Heading, Note, Panel, Pill, TextInput } from "@/components/Bubbles";
import { fetchMyPublicProfile, setMyPublicProfile } from "@/lib/community";

/**
 * A coach's optional public handle. It is the only name attached to plays they
 * publish — the private email and team data never appear in the Library.
 */
export function PublicProfilePanel() {
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["my-public-profile"], queryFn: fetchMyPublicProfile });
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    setUsername(mine.data?.username ?? "");
    setDisplayName(mine.data?.public_display_name ?? "");
    setBio(mine.data?.bio ?? "");
  }, [mine.data?.username, mine.data?.public_display_name, mine.data?.bio]);

  const save = useMutation({
    mutationFn: () =>
      setMyPublicProfile({
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        bio: bio.trim(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-public-profile"] });
      void qc.invalidateQueries({ queryKey: ["library-feed"] });
      toast.success("Public coach handle saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel className="flex flex-col gap-3">
      <Heading tone="grape">Public coach handle</Heading>
      <Note>
        Used only on plays you publish to the CoachSide Library. Your email, roster and team data
        stay private.
      </Note>
      {mine.data?.username ? (
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="grape">@{mine.data.username}</Pill>
          <Link to="/coach/$username" params={{ username: mine.data.username }} className="ml-auto">
            <BubbleButton size="sm" tone="neutral">
              View public page
            </BubbleButton>
          </Link>
        </div>
      ) : null}
      <Field label="Handle">
        <TextInput
          placeholder="coachbolton"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Field>
      <Field label="Public display name">
        <TextInput
          placeholder="Coach Bolton"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </Field>
      <Field label="Short bio">
        <TextInput
          placeholder="East High Varsity Basketball"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </Field>
      <BubbleButton
        tone="grape"
        disabled={save.isPending || !username.trim()}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Saving…" : "Save public handle"}
      </BubbleButton>
      <Note>
        Prefer to stay unnamed? Publish any play with “Publish anonymously” and it shows as
        Anonymous Coach.
      </Note>
    </Panel>
  );
}
