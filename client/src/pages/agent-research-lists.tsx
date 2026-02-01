import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AgentLayout } from "@/components/layout/agent-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Plus,
  ListChecks,
  Eye,
  Edit,
  Trash2,
  Share2,
  Filter,
  Search,
  FolderOpen,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ResearchList {
  id: string;
  name: string;
  description: string | null;
  universeType: string;
  visibility: string;
  isEditable: boolean;
  isArchived: boolean;
  tags: string[];
  cachedMetrics: any;
  createdByAgentId: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

const universeTypes = [
  { value: "MF", label: "Mutual Funds" },
  { value: "STOCK", label: "Stocks" },
  { value: "BOND", label: "Bonds" },
  { value: "ETF", label: "ETFs" },
  { value: "FD", label: "Fixed Deposits" },
  { value: "MIXED", label: "Mixed" },
];

const visibilityOptions = [
  { value: "private", label: "Private" },
  { value: "team", label: "Team" },
  { value: "org", label: "Organization" },
];

export default function AgentResearchLists() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUniverse, setFilterUniverse] = useState<string>("all");

  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [newListUniverse, setNewListUniverse] = useState("MF");
  const [newListVisibility, setNewListVisibility] = useState("private");

  const { data, isLoading } = useQuery<{ success: boolean; lists: ResearchList[] }>({
    queryKey: ["/api/research-lists"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/research-lists", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Research list created" });
      queryClient.invalidateQueries({ queryKey: ["/api/research-lists"] });
      setIsCreateDialogOpen(false);
      setNewListName("");
      setNewListDescription("");
      setNewListUniverse("MF");
      setNewListVisibility("private");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create research list", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/research-lists/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Research list deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/research-lists"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete research list", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!newListName.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: newListName,
      description: newListDescription,
      universeType: newListUniverse,
      visibility: newListVisibility,
    });
  };

  const filteredLists = (data?.lists || []).filter((list) => {
    const matchesSearch = list.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUniverse = filterUniverse === "all" || list.universeType === filterUniverse;
    return matchesSearch && matchesUniverse;
  });

  const getUniverseColor = (universe: string) => {
    const colors: Record<string, string> = {
      MF: "bg-blue-500",
      STOCK: "bg-green-500",
      BOND: "bg-amber-500",
      ETF: "bg-purple-500",
      FD: "bg-cyan-500",
      MIXED: "bg-slate-500",
    };
    return colors[universe] || "bg-slate-500";
  };

  return (
    <AgentLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
              <ListChecks className="h-7 w-7 text-blue-400" />
              Research Lists
            </h1>
            <p className="text-slate-400 mt-1">
              Create and manage curated instrument lists for client recommendations
            </p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New List
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Research List</DialogTitle>
                <DialogDescription>
                  Create a new curated list of instruments for your research and recommendations.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">List Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Top Large Cap Funds Q1 2026"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the purpose of this research list..."
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Universe Type</Label>
                    <Select value={newListUniverse} onValueChange={setNewListUniverse}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {universeTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    <Select value={newListVisibility} onValueChange={setNewListVisibility}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {visibilityOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create List"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search lists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-600"
                />
              </div>
              <Select value={filterUniverse} onValueChange={setFilterUniverse}>
                <SelectTrigger className="w-[180px] bg-slate-900 border-slate-600">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by universe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Universes</SelectItem>
                  {universeTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-slate-400">Loading research lists...</div>
            ) : filteredLists.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="h-12 w-12 mx-auto text-slate-500 mb-4" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">No research lists yet</h3>
                <p className="text-slate-400 mb-4">
                  Create your first research list to start curating instruments for client recommendations.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First List
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">List Name</TableHead>
                      <TableHead className="text-slate-300">Universe</TableHead>
                      <TableHead className="text-slate-300 text-center">Items</TableHead>
                      <TableHead className="text-slate-300">Visibility</TableHead>
                      <TableHead className="text-slate-300">Last Modified</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLists.map((list) => (
                      <TableRow key={list.id} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell>
                          <div>
                            <Link href={`/agent/research-lists/${list.id}`}>
                              <span className="font-medium text-white hover:text-blue-400 cursor-pointer">
                                {list.name}
                              </span>
                            </Link>
                            {list.description && (
                              <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                                {list.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getUniverseColor(list.universeType)} text-white`}>
                            {list.universeType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-slate-300">{list.itemCount}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {list.visibility}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {formatDistanceToNow(new Date(list.updatedAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/agent/research-lists/${list.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Share2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-300"
                              onClick={() => {
                                if (confirm("Delete this research list?")) {
                                  deleteMutation.mutate(list.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
}
